/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { z, type ZodObject, type ZodRawShape } from 'zod';
import { db } from '../../db/index.js';
import { logActivity } from '../../lib/activity.js';
import { escapeLike } from '../../lib/catalog.js';
import { notFound, paginate, parse, toId } from '../../lib/http.js';
import type { Module } from '../../lib/permissions.js';
import { slugify } from '../../lib/slug.js';
import { boolQuery } from '../../lib/validation.js';
import { requirePermission } from '../../middleware/auth.js';

type Table = PgTable & Record<string, PgColumn>;

export type CrudConfig = {
  table: Table;
  entity: string;
  module: Module;
  schema: ZodObject<ZodRawShape>;
  searchColumns?: PgColumn[];
  defaultOrder?: SQL[];
  softDelete?: boolean;
  /** Generate `slug` from this field when the slug is empty */
  slugFrom?: string;
  /** Extra list filters taken from the querystring */
  filters?: (query: Record<string, unknown>) => SQL[];
  /** Unique text columns renamed on soft delete so the value can be reused */
  releaseOnDelete?: string[];
};

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  active: boolQuery,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  sort: z.enum(['newest', 'oldest', 'order']).default('order'),
});

export function crudRouter(cfg: CrudConfig) {
  const router = Router();
  const t = cfg.table as any;
  const notDeleted = (): SQL[] => (cfg.softDelete && t.deletedAt ? [isNull(t.deletedAt)] : []);

  const prepare = (data: Record<string, any>) => {
    if (cfg.slugFrom && 'slug' in cfg.schema.shape) {
      data.slug = data.slug ? slugify(data.slug) : slugify(String(data[cfg.slugFrom] ?? ''));
    }
    return data;
  };

  router.get('/', requirePermission(cfg.module, 'view'), async (req, res) => {
    const q = parse(listQuery, req.query);
    const conds: SQL[] = [...notDeleted(), ...(cfg.filters?.(req.query as Record<string, unknown>) ?? [])];
    if (q.active !== undefined && t.isActive) conds.push(eq(t.isActive, q.active));
    if (q.search && cfg.searchColumns?.length) {
      const term = `%${escapeLike(q.search)}%`;
      conds.push(or(...cfg.searchColumns.map((c) => ilike(c, term)))!);
    }
    const where = conds.length ? and(...conds) : undefined;
    const { limit, offset, page } = paginate(q.page, q.limit);
    const order =
      q.sort === 'newest'
        ? [desc(t.createdAt ?? t.id)]
        : q.sort === 'oldest'
          ? [asc(t.createdAt ?? t.id)]
          : (cfg.defaultOrder ?? [t.sortOrder ? asc(t.sortOrder) : desc(t.id), desc(t.id)]);

    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(cfg.table).where(where);
    const items = await db
      .select()
      .from(cfg.table)
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset(offset);
    res.json({ items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  });

  router.get('/:id', requirePermission(cfg.module, 'view'), async (req, res) => {
    const id = toId(req.params.id);
    const [row] = await db.select().from(cfg.table).where(and(eq(t.id, id), ...notDeleted()));
    if (!row) throw notFound(cfg.entity);
    res.json({ item: row });
  });

  router.post('/', requirePermission(cfg.module, 'create'), async (req, res) => {
    const data = prepare(parse(cfg.schema, req.body));
    const [row] = await db.insert(cfg.table).values(data as any).returning();
    await logActivity(req, 'CREATE', cfg.entity, (row as any).id, { name: data.name ?? data.title ?? data.customerName });
    res.status(201).json({ item: row });
  });

  router.put('/:id', requirePermission(cfg.module, 'edit'), async (req, res) => {
    const id = toId(req.params.id);
    const data = prepare(parse(cfg.schema.partial(), req.body));
    const [row] = await db
      .update(cfg.table)
      .set(data as any)
      .where(and(eq(t.id, id), ...notDeleted()))
      .returning();
    if (!row) throw notFound(cfg.entity);
    await logActivity(req, 'UPDATE', cfg.entity, id, { fields: Object.keys(data) });
    res.json({ item: row });
  });

  router.patch('/:id/status', requirePermission(cfg.module, 'edit'), async (req, res) => {
    const id = toId(req.params.id);
    const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
    const [row] = await db
      .update(cfg.table)
      .set({ isActive } as any)
      .where(and(eq(t.id, id), ...notDeleted()))
      .returning();
    if (!row) throw notFound(cfg.entity);
    await logActivity(req, isActive ? 'ACTIVATE' : 'DEACTIVATE', cfg.entity, id);
    res.json({ item: row });
  });

  router.delete('/:id', requirePermission(cfg.module, 'delete'), async (req, res) => {
    const id = toId(req.params.id);
    const result =
      cfg.softDelete && t.deletedAt
        ? await db
            .update(cfg.table)
            .set({
              deletedAt: new Date(),
              isActive: false,
              ...Object.fromEntries(
                (cfg.releaseOnDelete ?? []).map((col) => [col, sql`left(${t[col]}, 60) || '~deleted-' || ${t.id}`]),
              ),
            } as any)
            .where(and(eq(t.id, id), isNull(t.deletedAt)))
            .returning({ id: t.id })
        : await db.delete(cfg.table).where(eq(t.id, id)).returning({ id: t.id });
    if (!result.length) throw notFound(cfg.entity);
    await logActivity(req, 'DELETE', cfg.entity, id);
    res.json({ ok: true });
  });

  return router;
}
