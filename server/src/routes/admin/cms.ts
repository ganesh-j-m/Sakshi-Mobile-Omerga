import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { cmsPages } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { badRequest, notFound, parse } from '../../lib/http.js';
import { cleanText, optText } from '../../lib/validation.js';
import { requirePermission } from '../../middleware/auth.js';

const router = Router();

/** Recursively clean every string inside CMS JSON (no HTML allowed in CMS content). */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 8) throw badRequest('Content is nested too deeply');
  if (typeof value === 'string') return cleanText(value).slice(0, 10000);
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([k, v]) => [k.slice(0, 60), sanitize(v, depth + 1)]),
    );
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return null;
}

router.get('/', requirePermission('CMS', 'view'), async (_req, res) => {
  const rows = await db
    .select({ key: cmsPages.key, title: cmsPages.title, updatedAt: cmsPages.updatedAt })
    .from(cmsPages)
    .orderBy(asc(cmsPages.key));
  res.json({ items: rows });
});

router.get('/:key', requirePermission('CMS', 'view'), async (req, res) => {
  const row = await db.query.cmsPages.findFirst({ where: eq(cmsPages.key, String(req.params.key)) });
  if (!row) throw notFound('Content block');
  res.json({ item: row });
});

const updateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  content: z.record(z.unknown()),
  metaTitle: optText(160),
  metaDescription: optText(320),
});

router.put('/:key', requirePermission('CMS', 'edit'), async (req, res) => {
  const key = String(req.params.key);
  const body = parse(updateSchema, req.body);
  if (JSON.stringify(body.content).length > 200_000) throw badRequest('Content is too large');
  const existing = await db.query.cmsPages.findFirst({ where: eq(cmsPages.key, key) });
  if (!existing) throw notFound('Content block');
  const [row] = await db
    .update(cmsPages)
    .set({
      title: body.title ?? existing.title,
      content: sanitize(body.content) as Record<string, unknown>,
      metaTitle: body.metaTitle,
      metaDescription: body.metaDescription,
      updatedById: req.user!.id,
    })
    .where(eq(cmsPages.key, key))
    .returning();
  await logActivity(req, 'UPDATE', 'cms', key);
  res.json({ item: row });
});

export default router;
