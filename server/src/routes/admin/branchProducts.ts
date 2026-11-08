import { Router } from 'express';
import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { branchProducts, brands, categories, products } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { escapeLike, STOCK } from '../../lib/catalog.js';
import { paginate, parse, toId } from '../../lib/http.js';
import { optInt } from '../../lib/validation.js';
import { assertBranchAccess, requirePermission } from '../../middleware/auth.js';

const router = Router();

router.get('/:branchId', requirePermission('BRANCH_PRODUCTS', 'view'), async (req, res) => {
  const branchId = toId(req.params.branchId, 'branch');
  assertBranchAccess(req.user, branchId);
  const q = parse(
    z.object({
      search: z.string().trim().max(100).optional(),
      type: z.enum(['MOBILE', 'ACCESSORY']).optional(),
      assigned: z.enum(['all', 'yes', 'no']).default('all'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }),
    req.query,
  );
  const conds: (SQL | undefined)[] = [isNull(products.deletedAt)];
  if (q.search) {
    const term = `%${escapeLike(q.search)}%`;
    conds.push(or(ilike(products.name, term), ilike(products.sku, term), ilike(brands.name, term)));
  }
  if (q.type) conds.push(eq(categories.type, q.type));
  if (q.assigned === 'yes') conds.push(sql`${branchProducts.id} is not null`);
  if (q.assigned === 'no') conds.push(sql`${branchProducts.id} is null`);
  const where = and(...conds);
  const { limit, offset, page } = paginate(q.page, q.limit);

  const base = db
    .select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      brand: brands.name,
      category: categories.name,
      type: categories.type,
      sellingPrice: products.sellingPrice,
      offerPrice: products.offerPrice,
      globalStock: products.stockStatus,
      assigned: sql<boolean>`${branchProducts.id} is not null`,
      stockStatus: branchProducts.stockStatus,
      branchPrice: branchProducts.branchPrice,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(branchProducts, and(eq(branchProducts.productId, products.id), eq(branchProducts.branchId, branchId)));

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(branchProducts, and(eq(branchProducts.productId, products.id), eq(branchProducts.branchId, branchId)))
    .where(where);

  const items = await base.where(where).orderBy(asc(brands.name), asc(products.name)).limit(limit).offset(offset);
  res.json({ items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        assigned: z.boolean(),
        stockStatus: z.enum(STOCK).default('IN_STOCK'),
        branchPrice: optInt,
      }),
    )
    .min(1)
    .max(500),
});

router.put('/:branchId', requirePermission('BRANCH_PRODUCTS', 'edit'), async (req, res) => {
  const branchId = toId(req.params.branchId, 'branch');
  assertBranchAccess(req.user, branchId);
  const { items } = parse(bulkSchema, req.body);
  await db.transaction(async (tx) => {
    const remove = items.filter((i) => !i.assigned).map((i) => i.productId);
    if (remove.length) {
      await tx.delete(branchProducts).where(and(eq(branchProducts.branchId, branchId), inArray(branchProducts.productId, remove)));
    }
    for (const i of items.filter((x) => x.assigned)) {
      await tx
        .insert(branchProducts)
        .values({ branchId, productId: i.productId, stockStatus: i.stockStatus, branchPrice: i.branchPrice })
        .onConflictDoUpdate({
          target: [branchProducts.branchId, branchProducts.productId],
          set: { stockStatus: i.stockStatus, branchPrice: i.branchPrice, updatedAt: new Date() },
        });
    }
  });
  await logActivity(req, 'UPDATE_AVAILABILITY', 'branch', branchId, { count: items.length });
  res.json({ ok: true });
});

export default router;
