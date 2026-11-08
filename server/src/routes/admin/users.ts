import { Router } from 'express';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { adminBranches, adminPermissions, adminProfiles, users } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { badRequest, notFound, parse, toId } from '../../lib/http.js';
import { hashPassword, passwordSchema } from '../../lib/password.js';
import { DEFAULT_ADMIN_PERMISSIONS, MODULES } from '../../lib/permissions.js';
import { optPhone, optText, requiredText } from '../../lib/validation.js';

/** Admin account management — mounted behind requireSuperAdmin. */
const router = Router();

const permFlags = z.object({ view: z.boolean(), create: z.boolean(), edit: z.boolean(), delete: z.boolean() });
const permissionsSchema = z.record(z.enum(MODULES), permFlags);

const profileSchema = z.object({
  email: z.union([z.string().trim().email(), z.literal(''), z.null()]).optional().transform((v) => v || null),
  fullName: requiredText(120, 2),
  phone: optPhone,
  designation: optText(120),
  permissions: permissionsSchema.optional(),
  branchIds: z.array(z.number().int().positive()).max(200).default([]),
});

const createSchema = profileSchema.extend({
  loginId: z
    .string()
    .trim()
    .min(4)
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dot, underscore or hyphen'),
  password: passwordSchema,
});

async function serialize(id: number) {
  const u = await db.query.users.findFirst({
    where: and(eq(users.id, id), isNull(users.deletedAt)),
    columns: { passwordHash: false, tokenVersion: false },
    with: { profile: true, permissions: true, branches: { with: { branch: { columns: { id: true, name: true, code: true } } } } },
  });
  if (!u) throw notFound('Admin');
  const { permissions, branches, ...rest } = u;
  return {
    ...rest,
    permissions: Object.fromEntries(
      permissions.map((p) => [p.module, { view: p.canView, create: p.canCreate, edit: p.canEdit, delete: p.canDelete }]),
    ),
    branches: branches.map((b) => b.branch),
    branchIds: branches.map((b) => b.branchId),
  };
}

async function writePermissions(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: number,
  perms: z.infer<typeof permissionsSchema> | undefined,
  branchIds: number[],
) {
  if (perms) {
    await tx.delete(adminPermissions).where(eq(adminPermissions.userId, userId));
    const rows = Object.entries(perms).map(([module, p]) => ({
      userId,
      module,
      canView: p.view || p.create || p.edit || p.delete,
      canCreate: p.create,
      canEdit: p.edit,
      canDelete: p.delete,
    }));
    if (rows.length) await tx.insert(adminPermissions).values(rows);
  }
  await tx.delete(adminBranches).where(eq(adminBranches.userId, userId));
  if (branchIds.length) await tx.insert(adminBranches).values([...new Set(branchIds)].map((branchId) => ({ userId, branchId })));
}

router.get('/', async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      loginId: users.loginId,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      fullName: adminProfiles.fullName,
      designation: adminProfiles.designation,
      phone: adminProfiles.phone,
      branchCount: sql<number>`(select count(*)::int from admin_branches ab where ab.user_id = ${users.id})`,
    })
    .from(users)
    .leftJoin(adminProfiles, eq(adminProfiles.userId, users.id))
    .where(isNull(users.deletedAt))
    .orderBy(asc(users.role), asc(users.loginId));
  res.json({ items: rows, modules: MODULES, defaultPermissions: DEFAULT_ADMIN_PERMISSIONS });
});

router.get('/:id', async (req, res) => {
  res.json({ item: await serialize(toId(req.params.id)) });
});

router.post('/', async (req, res) => {
  const body = parse(createSchema, req.body);
  const exists = await db.query.users.findFirst({ where: eq(sql`lower(${users.loginId})`, body.loginId.toLowerCase()) });
  if (exists) throw badRequest('This Login ID is already taken', { loginId: 'Already taken' });
  const id = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ loginId: body.loginId, email: body.email, passwordHash: await hashPassword(body.password), role: 'ADMIN' })
      .returning({ id: users.id });
    await tx.insert(adminProfiles).values({ userId: u.id, fullName: body.fullName, phone: body.phone, designation: body.designation });
    await writePermissions(tx, u.id, body.permissions ?? DEFAULT_ADMIN_PERMISSIONS, body.branchIds);
    return u.id;
  });
  await logActivity(req, 'CREATE', 'admin', id, { loginId: body.loginId });
  res.status(201).json({ item: await serialize(id) });
});

router.put('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const body = parse(profileSchema, req.body);
  const target = await db.query.users.findFirst({ where: and(eq(users.id, id), isNull(users.deletedAt)) });
  if (!target) throw notFound('Admin');
  await db.transaction(async (tx) => {
    await tx.update(users).set({ email: body.email }).where(eq(users.id, id));
    await tx
      .insert(adminProfiles)
      .values({ userId: id, fullName: body.fullName, phone: body.phone, designation: body.designation })
      .onConflictDoUpdate({
        target: adminProfiles.userId,
        set: { fullName: body.fullName, phone: body.phone, designation: body.designation, updatedAt: new Date() },
      });
    if (target.role === 'ADMIN') await writePermissions(tx, id, body.permissions, body.branchIds);
  });
  await logActivity(req, 'UPDATE', 'admin', id);
  res.json({ item: await serialize(id) });
});

router.patch('/:id/status', async (req, res) => {
  const id = toId(req.params.id);
  if (id === req.user!.id) throw badRequest('You cannot deactivate your own account');
  const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
  const [row] = await db
    .update(users)
    .set({ isActive, tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(and(eq(users.id, id), isNull(users.deletedAt), eq(users.role, 'ADMIN')))
    .returning({ id: users.id });
  if (!row) throw notFound('Admin');
  await logActivity(req, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'admin', id);
  res.json({ ok: true });
});

router.post('/:id/reset-password', async (req, res) => {
  const id = toId(req.params.id);
  const { password } = parse(z.object({ password: passwordSchema }), req.body);
  const [row] = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      tokenVersion: sql`${users.tokenVersion} + 1`,
      failedLoginAttempts: 0,
      lockedUntil: null,
    })
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .returning({ id: users.id });
  if (!row) throw notFound('Admin');
  await logActivity(req, 'RESET_PASSWORD', 'admin', id);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (id === req.user!.id) throw badRequest('You cannot delete your own account');
  const [row] = await db
    .update(users)
    .set({
      deletedAt: new Date(),
      isActive: false,
      tokenVersion: sql`${users.tokenVersion} + 1`,
      loginId: sql`left(${users.loginId}, 40) || '~deleted-' || ${users.id}`,
    })
    .where(and(eq(users.id, id), isNull(users.deletedAt), eq(users.role, 'ADMIN')))
    .returning({ id: users.id });
  if (!row) throw notFound('Admin');
  await logActivity(req, 'DELETE', 'admin', id);
  res.json({ ok: true });
});

export default router;
