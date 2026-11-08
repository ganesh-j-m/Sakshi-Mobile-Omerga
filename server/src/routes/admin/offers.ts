import { Router } from 'express';
import { and, asc, desc, eq, ilike, isNull, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { branchOffers, offers } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { escapeLike } from '../../lib/catalog.js';
import { badRequest, forbidden, notFound, parse, toId } from '../../lib/http.js';
import { slugify } from '../../lib/slug.js';
import { optDate, optInt, optText, optUrl, requiredText } from '../../lib/validation.js';
import { assertBranchAccess, requirePermission, type AuthUser } from '../../middleware/auth.js';

const router = Router();

const offerSchema = z
  .object({
    title: requiredText(160, 3),
    slug: z.string().max(180).optional().default(''),
    description: optText(3000),
    offerType: z.enum(['DISCOUNT', 'CASHBACK', 'EXCHANGE', 'EMI', 'BUNDLE', 'FESTIVAL']).default('DISCOUNT'),
    discountType: z.enum(['PERCENT', 'FLAT', 'NONE']).default('NONE'),
    discountValue: optInt,
    bannerUrl: optUrl,
    badge: optText(40),
    productId: optInt,
    brandId: optInt,
    validFrom: optDate,
    validTo: optDate,
    terms: optText(4000),
    isFeatured: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).default(0),
    branchIds: z.array(z.number().int().positive()).max(200).default([]),
  })
  .refine((o) => !o.validFrom || !o.validTo || o.validTo >= o.validFrom, { message: 'End date must be after start date', path: ['validTo'] })
  .refine((o) => o.discountType !== 'PERCENT' || (o.discountValue ?? 0) <= 100, { message: 'Percent cannot exceed 100', path: ['discountValue'] });

type OfferInput = z.infer<typeof offerSchema>;

/** Admins can only manage offers that belong exclusively to their branches. */
function canManage(user: AuthUser, branchIds: number[]) {
  if (user.branchIds === null) return true;
  return branchIds.length > 0 && branchIds.every((b) => user.branchIds!.includes(b));
}

router.get('/', requirePermission('OFFERS', 'view'), async (req, res) => {
  const q = parse(
    z.object({ search: z.string().trim().max(100).optional(), status: z.enum(['all', 'active', 'expired', 'inactive']).default('all') }),
    req.query,
  );
  const conds: (SQL | undefined)[] = [isNull(offers.deletedAt)];
  if (q.search) conds.push(ilike(offers.title, `%${escapeLike(q.search)}%`));
  if (q.status === 'active') conds.push(eq(offers.isActive, true), sql`(${offers.validTo} is null or ${offers.validTo} >= now())`);
  if (q.status === 'expired') conds.push(sql`${offers.validTo} < now()`);
  if (q.status === 'inactive') conds.push(eq(offers.isActive, false));
  const rows = await db.query.offers.findMany({
    where: and(...conds),
    orderBy: [asc(offers.sortOrder), desc(offers.createdAt)],
    with: {
      branchOffers: { with: { branch: { columns: { id: true, name: true } } } },
      brand: { columns: { name: true } },
      product: { columns: { name: true } },
    },
  });
  res.json({
    items: rows.map(({ branchOffers: bo, ...o }) => {
      const ids = bo.map((b) => b.branchId);
      return { ...o, branches: bo.map((b) => b.branch), branchIds: ids, editable: canManage(req.user!, ids) };
    }),
  });
});

router.get('/:id', requirePermission('OFFERS', 'view'), async (req, res) => {
  const id = toId(req.params.id);
  const row = await db.query.offers.findFirst({ where: and(eq(offers.id, id), isNull(offers.deletedAt)), with: { branchOffers: true } });
  if (!row) throw notFound('Offer');
  const { branchOffers: bo, ...rest } = row;
  const branchIds = bo.map((b) => b.branchId);
  res.json({ item: { ...rest, branchIds, editable: canManage(req.user!, branchIds) } });
});

function checkBranches(user: AuthUser, input: OfferInput) {
  if (user.branchIds === null) return;
  if (!input.branchIds.length) throw badRequest('Select at least one of your branches for this offer', { branchIds: 'Required' });
  for (const b of input.branchIds) assertBranchAccess(user, b);
}

const values = (input: OfferInput) => {
  const { branchIds: _b, ...rest } = input;
  return { ...rest, slug: slugify(rest.slug || rest.title) };
};

router.post('/', requirePermission('OFFERS', 'create'), async (req, res) => {
  const input = parse(offerSchema, req.body);
  checkBranches(req.user!, input);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(offers).values(values(input)).returning({ id: offers.id });
    if (input.branchIds.length) await tx.insert(branchOffers).values(input.branchIds.map((branchId) => ({ branchId, offerId: row.id })));
    return row.id;
  });
  await logActivity(req, 'CREATE', 'offer', id, { title: input.title });
  res.status(201).json({ id });
});

async function loadForWrite(user: AuthUser, id: number) {
  const row = await db.query.offers.findFirst({ where: and(eq(offers.id, id), isNull(offers.deletedAt)), with: { branchOffers: true } });
  if (!row) throw notFound('Offer');
  if (!canManage(user, row.branchOffers.map((b) => b.branchId))) throw forbidden('This offer covers branches not assigned to you');
  return row;
}

router.put('/:id', requirePermission('OFFERS', 'edit'), async (req, res) => {
  const id = toId(req.params.id);
  await loadForWrite(req.user!, id);
  const input = parse(offerSchema, req.body);
  checkBranches(req.user!, input);
  await db.transaction(async (tx) => {
    await tx.update(offers).set(values(input)).where(eq(offers.id, id));
    await tx.delete(branchOffers).where(eq(branchOffers.offerId, id));
    if (input.branchIds.length) await tx.insert(branchOffers).values(input.branchIds.map((branchId) => ({ branchId, offerId: id })));
  });
  await logActivity(req, 'UPDATE', 'offer', id, { title: input.title });
  res.json({ id });
});

router.patch('/:id/status', requirePermission('OFFERS', 'edit'), async (req, res) => {
  const id = toId(req.params.id);
  await loadForWrite(req.user!, id);
  const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
  await db.update(offers).set({ isActive }).where(eq(offers.id, id));
  await logActivity(req, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'offer', id);
  res.json({ ok: true });
});

router.delete('/:id', requirePermission('OFFERS', 'delete'), async (req, res) => {
  const id = toId(req.params.id);
  await loadForWrite(req.user!, id);
  await db
    .update(offers)
    .set({ deletedAt: new Date(), isActive: false, slug: sql`left(${offers.slug}, 140) || '~deleted-' || ${offers.id}` })
    .where(eq(offers.id, id));
  await logActivity(req, 'DELETE', 'offer', id);
  res.json({ ok: true });
});

export default router;
