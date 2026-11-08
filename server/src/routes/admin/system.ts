import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Router } from 'express';
import multer from 'multer';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { activityLogs, users } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { escapeLike } from '../../lib/catalog.js';
import { AppError, badRequest, notFound, paginate, parse } from '../../lib/http.js';
import { storeImage } from '../../lib/storage.js';
import { requireSuperAdmin } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/security.js';

const run = promisify(execFile);

/* ─────────────────────────────── Uploads ─────────────────────────────── */

export const uploadsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.mimetype)) {
      return cb(new AppError(400, 'Only JPG, PNG, WEBP or AVIF images are allowed'));
    }
    cb(null, true);
  },
});

uploadsRouter.post('/', uploadLimiter, upload.array('files', 10), async (req, res) => {
  const { folder } = parse(
    z.object({ folder: z.enum(['products', 'brands', 'branches', 'banners', 'offers', 'testimonials', 'cms', 'misc']).default('misc') }),
    req.query,
  );
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw badRequest('No image received');
  const stored = [];
  for (const f of files) stored.push(await storeImage(f.buffer, folder));
  await logActivity(req, 'UPLOAD', 'image', null, { folder, count: stored.length });
  res.status(201).json({ items: stored });
});

/* ──────────────────────────── Activity logs ──────────────────────────── */

export const logsRouter = Router();
logsRouter.use(requireSuperAdmin);

logsRouter.get('/', async (req, res) => {
  const q = parse(
    z.object({
      search: z.string().trim().max(100).optional(),
      entity: z.string().max(60).optional(),
      userId: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }),
    req.query,
  );
  const conds: (SQL | undefined)[] = [];
  if (q.entity) conds.push(eq(activityLogs.entity, q.entity));
  if (q.userId) conds.push(eq(activityLogs.userId, q.userId));
  if (q.search) {
    const term = `%${escapeLike(q.search)}%`;
    conds.push(or(ilike(activityLogs.action, term), ilike(activityLogs.entity, term), ilike(users.loginId, term)));
  }
  const where = conds.length ? and(...conds) : undefined;
  const { limit, offset, page } = paginate(q.page, q.limit);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(where);
  const items = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      entity: activityLogs.entity,
      entityId: activityLogs.entityId,
      details: activityLogs.details,
      ipAddress: activityLogs.ipAddress,
      createdAt: activityLogs.createdAt,
      loginId: users.loginId,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(where)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset);
  const entities = await db.selectDistinct({ entity: activityLogs.entity }).from(activityLogs);
  res.json({
    items,
    entities: entities.map((e) => e.entity).sort(),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

/* ─────────────────────────────── Backups ─────────────────────────────── */

export const backupsRouter = Router();
backupsRouter.use(requireSuperAdmin);

const backupDir = () => path.resolve(env.BACKUP_DIR);
const SAFE_NAME = /^sakshi-mobile-\d{8}-\d{6}\.dump$/;

export async function createBackup() {
  await fs.mkdir(backupDir(), { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const name = `sakshi-mobile-${stamp}.dump`;
  const file = path.join(backupDir(), name);
  // Custom format (-Fc) is compressed and restorable with pg_restore
  await run(env.PG_DUMP_PATH, ['--format=custom', '--no-owner', '--no-privileges', `--file=${file}`, `--dbname=${env.DATABASE_URL}`], {
    timeout: 10 * 60 * 1000,
  });
  await pruneBackups();
  const stat = await fs.stat(file);
  return { name, size: stat.size, createdAt: stat.mtime };
}

async function listBackups() {
  await fs.mkdir(backupDir(), { recursive: true });
  const names = (await fs.readdir(backupDir())).filter((n) => SAFE_NAME.test(n));
  const items = await Promise.all(
    names.map(async (name) => {
      const s = await fs.stat(path.join(backupDir(), name));
      return { name, size: s.size, createdAt: s.mtime };
    }),
  );
  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

async function pruneBackups() {
  const items = await listBackups();
  for (const old of items.slice(env.BACKUP_RETENTION)) await fs.unlink(path.join(backupDir(), old.name));
}

backupsRouter.get('/', async (_req, res) => {
  res.json({ items: await listBackups(), retention: env.BACKUP_RETENTION, directory: env.BACKUP_DIR });
});

backupsRouter.post('/', async (req, res) => {
  try {
    const item = await createBackup();
    await logActivity(req, 'CREATE', 'backup', item.name, { size: item.size });
    res.status(201).json({ item });
  } catch (err) {
    console.error('backup failed', err);
    throw new AppError(500, 'Backup failed. Check that pg_dump is installed on the server and matches the PostgreSQL version.');
  }
});

backupsRouter.get('/:name', async (req, res) => {
  const name = String(req.params.name);
  if (!SAFE_NAME.test(name)) throw badRequest('Invalid backup name');
  const file = path.join(backupDir(), name);
  try {
    await fs.access(file);
  } catch {
    throw notFound('Backup');
  }
  await logActivity(req, 'DOWNLOAD', 'backup', name);
  res.download(file, name);
});

backupsRouter.delete('/:name', async (req, res) => {
  const name = String(req.params.name);
  if (!SAFE_NAME.test(name)) throw badRequest('Invalid backup name');
  try {
    await fs.unlink(path.join(backupDir(), name));
  } catch {
    throw notFound('Backup');
  }
  await logActivity(req, 'DELETE', 'backup', name);
  res.json({ ok: true });
});
