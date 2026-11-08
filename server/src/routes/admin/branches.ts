import { Router } from 'express';
import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { adminBranches, branchBrands, branches, branchOffers } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { escapeLike } from '../../lib/catalog.js';
import { badRequest, notFound, parse, toId } from '../../lib/http.js';
import { slugify } from '../../lib/slug.js';
import { optPhone, optText, optUrl, requiredText } from '../../lib/validation.js';
import { assertBranchAccess, branchScope, isSuperAdmin, requirePermission } from '../../middleware/auth.js';

const router = Router();

const hours = z.object({
  day: z.string().min(2).max(20),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM').or(z.literal('')),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM').or(z.literal('')),
  closed: z.boolean().optional().default(false),
});

const branchSchema = z.object({
  code: requiredText(20).transform((v) => v.toUpperCase().replace(/[^A-Z0-9-]/g, '')),
  name: requiredText(150, 2),
  slug: z.string().max(120).optional().default(''),
  type: z.enum(['MAIN', 'BRANCH', 'FRANCHISE', 'SERVICE_CENTER']).default('BRANCH'),
  imageUrl: optUrl,
  intro: optText(3000),
  addressLine: optText(500),
  city: requiredText(80),
  district: optText(80),
  state: requiredText(80).default('Maharashtra'),
  pincode: z
    .union([z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'), z.literal(''), z.null()])
    .optional()
    .transform((v) => v || null),
  phone: optPhone,
  whatsapp: optPhone,
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional().transform((v) => v || null),
  openingHours: z.array(hours).max(7).default([]),
  mapsUrl: optUrl,
  latitude: z.union([z.coerce.number().min(-90).max(90), z.literal(''), z.null()]).optional().transform((v) => (v === '' || v == null ? null : v)),
  longitude: z.union([z.coerce.number().min(-180).max(180), z.literal(''), z.null()]).optional().transform((v) => (v === '' || v == null ? null : v)),
  services: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  brandIds: z.array(z.number().int().positive()).max(100).default([]),
  offerIds: z.array(z.number().int().positive()).max(200).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

type BranchInput = z.infer<typeof branchSchema>;

const scopeCondition = (scope: number[] | null): SQL | undefined =>
  scope === null ? undefined : inArray(branches.id, scope.length ? scope : [0]);

router.get('/', requirePermission('BRANCHES', 'view'), async (req, res) => {
  const { search } = parse(z.object({ search: z.string().trim().max(100).optional() }), req.query);
  const conds: (SQL | undefined)[] = [isNull(branches.deletedAt), scopeCondition(branchScope(req.user))];
  if (search) {
    const term = `%${escapeLike(search)}%`;
    conds.push(or(ilike(branches.name, term), ilike(branches.code, term), ilike(branches.city, term)));
  }
  const items = await db
    .select({
      id: branches.id,
      code: branches.code,
      slug: branches.slug,
      name: branches.name,
      type: branches.type,
      city: branches.city,
      district: branches.district,
      phone: branches.phone,
      whatsapp: branches.whatsapp,
      imageUrl: branches.imageUrl,
      isActive: branches.isActive,
      isDemo: branches.isDemo,
      sortOrder: branches.sortOrder,
      updatedAt: branches.updatedAt,
      productCount: sql<number>`(select count(*)::int from branch_products bp where bp.branch_id = ${branches.id})`,
      offerCount: sql<number>`(select count(*)::int from branch_offers bo where bo.branch_id = ${branches.id})`,
      newInquiries: sql<number>`(select count(*)::int from inquiries i where i.branch_id = ${branches.id} and i.status = 'NEW')`,
    })
    .from(branches)
    .where(and(...conds))
    .orderBy(asc(branches.sortOrder), asc(branches.name));
  res.json({ items });
});

router.get('/:id', requirePermission('BRANCHES', 'view'), async (req, res) => {
  const id = toId(req.params.id);
  assertBranchAccess(req.user, id);
  const branch = await db.query.branches.findFirst({
    where: and(eq(branches.id, id), isNull(branches.deletedAt)),
    with: { branchBrands: true, branchOffers: true },
  });
  if (!branch) throw notFound('Branch');
  const { branchBrands: bb, branchOffers: bo, ...rest } = branch;
  res.json({ item: { ...rest, brandIds: bb.map((b) => b.brandId), offerIds: bo.map((o) => o.offerId) } });
});

async function syncLinks(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], branchId: number, input: BranchInput) {
  await tx.delete(branchBrands).where(eq(branchBrands.branchId, branchId));
  if (input.brandIds.length) {
    await tx.insert(branchBrands).values([...new Set(input.brandIds)].map((brandId) => ({ branchId, brandId })));
  }
  await tx.delete(branchOffers).where(eq(branchOffers.branchId, branchId));
  if (input.offerIds.length) {
    await tx.insert(branchOffers).values([...new Set(input.offerIds)].map((offerId) => ({ branchId, offerId })));
  }
}

const values = (input: BranchInput) => {
  const { brandIds: _b, offerIds: _o, ...rest } = input;
  return { ...rest, slug: slugify(rest.slug || rest.name) };
};

router.post('/', requirePermission('BRANCHES', 'create'), async (req, res) => {
  const input = parse(branchSchema, req.body);
  const v = values(input);
  if (!v.slug) throw badRequest('Could not generate a URL slug');
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(branches).values(v).returning({ id: branches.id });
    await syncLinks(tx, row.id, input);
    // An admin who creates a branch automatically manages it
    if (!isSuperAdmin(req.user)) await tx.insert(adminBranches).values({ userId: req.user!.id, branchId: row.id });
    return row.id;
  });
  await logActivity(req, 'CREATE', 'branch', id, { name: input.name, code: input.code });
  res.status(201).json({ id });
});

router.put('/:id', requirePermission('BRANCHES', 'edit'), async (req, res) => {
  const id = toId(req.params.id);
  assertBranchAccess(req.user, id);
  const input = parse(branchSchema, req.body);
  const exists = await db.query.branches.findFirst({ where: and(eq(branches.id, id), isNull(branches.deletedAt)) });
  if (!exists) throw notFound('Branch');
  await db.transaction(async (tx) => {
    await tx.update(branches).set(values(input)).where(eq(branches.id, id));
    await syncLinks(tx, id, input);
  });
  await logActivity(req, 'UPDATE', 'branch', id, { name: input.name });
  res.json({ id });
});

router.patch('/:id/status', requirePermission('BRANCHES', 'edit'), async (req, res) => {
  const id = toId(req.params.id);
  assertBranchAccess(req.user, id);
  const { isActive } = parse(z.object({ isActive: z.boolean() }), req.body);
  const [row] = await db
    .update(branches)
    .set({ isActive })
    .where(and(eq(branches.id, id), isNull(branches.deletedAt)))
    .returning({ id: branches.id });
  if (!row) throw notFound('Branch');
  await logActivity(req, isActive ? 'ACTIVATE' : 'DEACTIVATE', 'branch', id);
  res.json({ ok: true });
});

router.delete('/:id', requirePermission('BRANCHES', 'delete'), async (req, res) => {
  const id = toId(req.params.id);
  assertBranchAccess(req.user, id);
  const [row] = await db
    .update(branches)
    .set({
      deletedAt: new Date(),
      isActive: false,
      code: sql`left(${branches.code}, 8) || '~' || ${branches.id}`,
      slug: sql`left(${branches.slug}, 90) || '~deleted-' || ${branches.id}`,
    })
    .where(and(eq(branches.id, id), isNull(branches.deletedAt)))
    .returning({ id: branches.id });
  if (!row) throw notFound('Branch');
  await logActivity(req, 'DELETE', 'branch', id);
  res.json({ ok: true });
});

export default router;
