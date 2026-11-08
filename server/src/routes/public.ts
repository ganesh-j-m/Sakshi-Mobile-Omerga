import { Router } from 'express';
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  banners,
  bills,
  branchBrands,
  branches,
  branchOffers,
  branchProducts,
  brands,
  categories,
  inquiries,
  offers,
  products,
  testimonials,
} from '../db/schema.js';
import {
  activeOfferCondition,
  listProducts,
  productFacets,
  productListQuery,
  productSummariesByIds,
} from '../lib/catalog.js';
import { notFound, parse } from '../lib/http.js';
import { DEFAULT_BILLING, DEFAULT_GENERAL, getCmsMap, getSetting, type SeoSettings } from '../lib/settings.js';
import { loadBill } from './admin/bills.js';
import { csvList, indianMobile, optText, requiredText } from '../lib/validation.js';
import { inquiryLimiter } from '../middleware/security.js';

const router = Router();

/* Short public caching keeps the site fast while admins still see changes within a minute. */
router.use((req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  next();
});

const activeBranch = and(eq(branches.isActive, true), isNull(branches.deletedAt));
const activeBrand = and(eq(brands.isActive, true), isNull(brands.deletedAt));

const branchCardColumns = {
  id: branches.id,
  code: branches.code,
  slug: branches.slug,
  name: branches.name,
  type: branches.type,
  imageUrl: branches.imageUrl,
  intro: branches.intro,
  addressLine: branches.addressLine,
  city: branches.city,
  district: branches.district,
  state: branches.state,
  pincode: branches.pincode,
  phone: branches.phone,
  whatsapp: branches.whatsapp,
  email: branches.email,
  openingHours: branches.openingHours,
  mapsUrl: branches.mapsUrl,
  latitude: branches.latitude,
  longitude: branches.longitude,
  services: branches.services,
  isDemo: branches.isDemo,
};

const activeBannerCondition = () => {
  const now = new Date();
  return and(
    eq(banners.isActive, true),
    or(isNull(banners.startsAt), lte(banners.startsAt, now)),
    or(isNull(banners.endsAt), gte(banners.endsAt, now)),
  );
};

async function offerList(where = activeOfferCondition(), limit = 50) {
  const rows = await db.query.offers.findMany({
    where,
    orderBy: [desc(offers.isFeatured), asc(offers.sortOrder), desc(offers.createdAt)],
    limit,
    with: {
      brand: { columns: { name: true, slug: true } },
      product: { columns: { name: true, slug: true } },
      branchOffers: { with: { branch: { columns: { id: true, name: true, slug: true, isActive: true } } } },
    },
  });
  return rows.map(({ branchOffers: bo, ...o }) => ({
    ...o,
    branches: bo.map((b) => b.branch).filter((b) => b.isActive),
  }));
}

/* ───────────── Site-wide data (navbar, footer, announcement, SEO) ───────────── */

router.get('/site', async (_req, res) => {
  const [general, seo, cms, cats, brandRows] = await Promise.all([
    getSetting('general', DEFAULT_GENERAL),
    getSetting<SeoSettings>('seo', {}),
    getCmsMap(['announcement', 'contact', 'footer', 'social']),
    db
      .select({ id: categories.id, name: categories.name, slug: categories.slug, type: categories.type, icon: categories.icon })
      .from(categories)
      .where(and(eq(categories.isActive, true), isNull(categories.deletedAt)))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select({ name: brands.name, slug: brands.slug, logoUrl: brands.logoUrl, accentColor: brands.accentColor })
      .from(brands)
      .where(activeBrand)
      .orderBy(asc(brands.sortOrder), asc(brands.name)),
  ]);
  const { maintenanceMode: _m, ...publicGeneral } = general;
  res.json({ general: publicGeneral, seo, cms, categories: cats, brands: brandRows });
});

router.get('/home', async (_req, res) => {
  const [cms, heroBanners, promoBanners, brandRows, featured, latest, accessories, offerRows, branchRows, reviews, stats] =
    await Promise.all([
      getCmsMap(['home_hero', 'why_choose']),
      db.select().from(banners).where(and(activeBannerCondition(), eq(banners.placement, 'HOME_HERO'))).orderBy(asc(banners.sortOrder)),
      db.select().from(banners).where(and(activeBannerCondition(), eq(banners.placement, 'HOME_PROMO'))).orderBy(asc(banners.sortOrder)),
      db.select().from(brands).where(activeBrand).orderBy(asc(brands.sortOrder), asc(brands.name)).limit(16),
      listProducts(parse(productListQuery, { featured: 'true', type: 'MOBILE', limit: 8, sort: 'featured' })),
      listProducts(parse(productListQuery, { type: 'MOBILE', limit: 8, sort: 'latest' })),
      listProducts(parse(productListQuery, { type: 'ACCESSORY', limit: 8, sort: 'featured' })),
      offerList(activeOfferCondition(), 6),
      db.select(branchCardColumns).from(branches).where(activeBranch).orderBy(asc(branches.sortOrder), asc(branches.name)).limit(6),
      db.select().from(testimonials).where(eq(testimonials.isActive, true)).orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt)).limit(12),
      db.execute<{ products: number; brands: number; branches: number }>(sql`
        select
          (select count(*)::int from products where deleted_at is null and is_active) as products,
          (select count(*)::int from brands where deleted_at is null and is_active) as brands,
          (select count(*)::int from branches where deleted_at is null and is_active) as branches`),
    ]);

  res.json({
    hero: cms.home_hero ?? null,
    whyChoose: cms.why_choose ?? null,
    heroBanners,
    promoBanners,
    brands: brandRows,
    featured: featured.items,
    latest: latest.items,
    accessories: accessories.items,
    offers: offerRows,
    branches: branchRows,
    testimonials: reviews,
    stats: stats.rows[0] ?? { products: 0, brands: 0, branches: 0 },
  });
});

router.get('/cms/:key', async (req, res) => {
  const allowed = ['about', 'privacy', 'terms', 'contact', 'why_choose'];
  const key = String(req.params.key);
  if (!allowed.includes(key)) throw notFound('Page');
  const page = await db.query.cmsPages.findFirst({ where: (t, { eq: e }) => e(t.key, key) });
  if (!page) throw notFound('Page');
  res.json({ key: page.key, title: page.title, content: page.content, metaTitle: page.metaTitle, metaDescription: page.metaDescription, updatedAt: page.updatedAt });
});

/* ─────────────────────────────── Products ─────────────────────────────── */

router.get('/products', async (req, res) => {
  const q = parse(productListQuery.omit({ active: true }), req.query);
  res.json(await listProducts({ ...q, active: undefined }));
});

router.get('/products/facets', async (req, res) => {
  const type = parse(z.object({ type: z.enum(['MOBILE', 'ACCESSORY']).optional() }), req.query).type;
  res.json(await productFacets(type));
});

router.get('/products/compare', async (req, res) => {
  const { slugs } = parse(z.object({ slugs: csvList }), req.query);
  const list = slugs.slice(0, 4);
  if (!list.length) return res.json({ items: [] });
  const rows = await db.query.products.findMany({
    where: and(inArray(products.slug, list), eq(products.isActive, true), isNull(products.deletedAt)),
    with: {
      brand: { columns: { name: true, slug: true } },
      category: { columns: { name: true, slug: true, type: true } },
      images: { orderBy: (t, o) => [o.asc(t.sortOrder)], limit: 1 },
      variants: { orderBy: (t, o) => [o.asc(t.sortOrder)] },
    },
  });
  // keep the order requested by the user
  res.json({ items: list.map((s) => rows.find((r) => r.slug === s)).filter(Boolean) });
});

router.get('/products/:slug', async (req, res) => {
  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, String(req.params.slug)), eq(products.isActive, true), isNull(products.deletedAt)),
    with: {
      brand: true,
      category: true,
      images: { orderBy: (t, o) => [o.asc(t.sortOrder), o.asc(t.id)] },
      variants: { orderBy: (t, o) => [o.asc(t.sortOrder)] },
      branchProducts: { with: { branch: { columns: branchCardKeys() } } },
    },
  });
  if (!product) throw notFound('Product');

  const { branchProducts: bp, ...rest } = product;
  const availability = bp
    .filter((b) => b.branch.isActive && !b.branch.deletedAt)
    .map((b) => ({ stockStatus: b.stockStatus, branchPrice: b.branchPrice, branch: b.branch }));

  const related = await listProducts(
    parse(productListQuery, {
      category: product.category.slug,
      exclude: String(product.id),
      limit: 8,
      sort: 'featured',
    }),
  );
  let relatedItems = related.items;
  if (relatedItems.length < 4) {
    const byBrand = await listProducts(
      parse(productListQuery, { brand: product.brand.slug, exclude: String(product.id), limit: 8 }),
    );
    const seen = new Set(relatedItems.map((r) => r.id));
    relatedItems = [...relatedItems, ...byBrand.items.filter((p) => !seen.has(p.id))].slice(0, 8);
  }

  const productOffers = await offerList(
    and(activeOfferCondition(), or(eq(offers.productId, product.id), eq(offers.brandId, product.brandId)))!,
    6,
  );

  res.json({ product: { ...rest, availability }, related: relatedItems, offers: productOffers });
});

function branchCardKeys() {
  return {
    id: true,
    slug: true,
    name: true,
    city: true,
    phone: true,
    whatsapp: true,
    addressLine: true,
    isActive: true,
    deletedAt: true,
  } as const;
}

/* ──────────────────────────────── Brands ──────────────────────────────── */

router.get('/brands', async (_req, res) => {
  const rows = await db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      logoUrl: brands.logoUrl,
      bannerUrl: brands.bannerUrl,
      description: brands.description,
      accentColor: brands.accentColor,
      isFeatured: brands.isFeatured,
      productCount: sql<number>`(select count(*)::int from products p where p.brand_id = ${brands.id} and p.is_active and p.deleted_at is null)`,
    })
    .from(brands)
    .where(activeBrand)
    .orderBy(asc(brands.sortOrder), asc(brands.name));
  res.json({ items: rows });
});

router.get('/brands/:slug', async (req, res) => {
  const brand = await db.query.brands.findFirst({
    where: and(eq(brands.slug, String(req.params.slug)), activeBrand),
  });
  if (!brand) throw notFound('Brand');
  const [stats, brandOffers, availableAt] = await Promise.all([
    db.execute<{ total: number; min: number | null; max: number | null }>(sql`
      select count(*)::int as total, min(coalesce(offer_price, selling_price))::int as min, max(coalesce(offer_price, selling_price))::int as max
      from products where brand_id = ${brand.id} and is_active and deleted_at is null`),
    offerList(and(activeOfferCondition(), eq(offers.brandId, brand.id))!, 6),
    db
      .select({ name: branches.name, slug: branches.slug, city: branches.city })
      .from(branchBrands)
      .innerJoin(branches, eq(branchBrands.branchId, branches.id))
      .where(and(eq(branchBrands.brandId, brand.id), activeBranch)),
  ]);
  res.json({ brand, stats: stats.rows[0], offers: brandOffers, branches: availableAt });
});

router.get('/categories', async (_req, res) => {
  const rows = await db
    .select()
    .from(categories)
    .where(and(eq(categories.isActive, true), isNull(categories.deletedAt)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  res.json({ items: rows });
});

/* ──────────────────────────────── Offers ──────────────────────────────── */

router.get('/offers', async (req, res) => {
  const { type, branch } = parse(
    z.object({
      type: z.enum(['DISCOUNT', 'CASHBACK', 'EXCHANGE', 'EMI', 'BUNDLE', 'FESTIVAL']).optional(),
      branch: z.string().max(120).optional(),
    }),
    req.query,
  );
  let items = await offerList(type ? and(activeOfferCondition(), eq(offers.offerType, type))! : activeOfferCondition(), 100);
  if (branch) items = items.filter((o) => o.branches.length === 0 || o.branches.some((b) => b.slug === branch));
  const banner = await db
    .select()
    .from(banners)
    .where(and(activeBannerCondition(), eq(banners.placement, 'OFFERS_PAGE')))
    .orderBy(asc(banners.sortOrder));
  res.json({ items, banners: banner });
});

/* ─────────────────────────────── Branches ─────────────────────────────── */

router.get('/branches', async (_req, res) => {
  const rows = await db.select(branchCardColumns).from(branches).where(activeBranch).orderBy(asc(branches.sortOrder), asc(branches.name));
  res.json({ items: rows });
});

router.get('/branches/:slug', async (req, res) => {
  const [branch] = await db
    .select(branchCardColumns)
    .from(branches)
    .where(and(eq(branches.slug, String(req.params.slug)), activeBranch));
  if (!branch) throw notFound('Branch');

  const [brandRows, offerIds, productIds] = await Promise.all([
    db
      .select({ name: brands.name, slug: brands.slug, logoUrl: brands.logoUrl, accentColor: brands.accentColor })
      .from(branchBrands)
      .innerJoin(brands, eq(branchBrands.brandId, brands.id))
      .where(and(eq(branchBrands.branchId, branch.id), activeBrand))
      .orderBy(asc(brands.sortOrder)),
    db.select({ id: branchOffers.offerId }).from(branchOffers).where(eq(branchOffers.branchId, branch.id)),
    db
      .select({ id: branchProducts.productId })
      .from(branchProducts)
      .where(and(eq(branchProducts.branchId, branch.id), sql`${branchProducts.stockStatus} <> 'OUT_OF_STOCK'`))
      .orderBy(desc(branchProducts.updatedAt))
      .limit(12),
  ]);

  const branchOfferList = offerIds.length
    ? await offerList(and(activeOfferCondition(), inArray(offers.id, offerIds.map((o) => o.id)))!, 12)
    : [];
  const productList = await productSummariesByIds(productIds.map((p) => p.id));
  const [{ count: productCount }] = (
    await db.execute<{ count: number }>(
      sql`select count(*)::int as count from branch_products where branch_id = ${branch.id}`,
    )
  ).rows;

  res.json({ branch, brands: brandRows, offers: branchOfferList, products: productList, productCount });
});

/* ─────────────────────────────── Reviews ─────────────────────────────── */

router.get('/testimonials', async (_req, res) => {
  const rows = await db.select().from(testimonials).where(eq(testimonials.isActive, true)).orderBy(asc(testimonials.sortOrder));
  res.json({ items: rows });
});

/* ──────────────────────── Customer bill link (WhatsApp) ─────────────────────── */

router.get('/bills/:token', async (req, res) => {
  const token = String(req.params.token);
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) throw notFound('Bill');
  const bill = await loadBill(eq(bills.publicToken, token));
  if (!bill) throw notFound('Bill');
  res.set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex, nofollow');
  const { createdBy: _c, createdById: _ci, cancelledById: _cb, publicToken: _t, whatsappMessageId: _w, whatsappError: _we, notes, ...rest } = bill;
  res.json({
    bill: {
      ...rest,
      notes,
      // Mask the mobile number on the shareable page
      customerMobile: bill.customerMobile.replace(/^(\d{2})\d{5}(\d{3})$/, '$1XXXXX$2'),
    },
    billing: await getSetting('billing', DEFAULT_BILLING),
  });
});

/* ─────────────────────────────── Inquiries ────────────────────────────── */

const inquirySchema = z.object({
  customerName: requiredText(120, 2),
  mobile: indianMobile,
  email: z.union([z.string().trim().email('Enter a valid email').max(255), z.literal(''), z.null()]).optional(),
  type: z.enum(['PRODUCT', 'BRANCH', 'OFFER', 'GENERAL', 'EXCHANGE', 'EMI']).default('GENERAL'),
  productId: z.coerce.number().int().positive().optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  offerId: z.coerce.number().int().positive().optional().nullable(),
  message: optText(2000),
  /** honeypot — real users never fill this hidden field */
  website: z.string().max(200).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept to be contacted' }) }),
});

router.post('/inquiries', inquiryLimiter, async (req, res) => {
  const body = parse(inquirySchema, req.body);
  if (body.website) return res.status(201).json({ ok: true }); // silently drop bots

  const [productOk, branchOk, offerOk] = await Promise.all([
    body.productId
      ? db.query.products.findFirst({ where: and(eq(products.id, body.productId), isNull(products.deletedAt)), columns: { id: true } })
      : null,
    body.branchId ? db.query.branches.findFirst({ where: and(eq(branches.id, body.branchId), activeBranch), columns: { id: true } }) : null,
    body.offerId ? db.query.offers.findFirst({ where: eq(offers.id, body.offerId), columns: { id: true } }) : null,
  ]);

  const [row] = await db
    .insert(inquiries)
    .values({
      customerName: body.customerName,
      mobile: body.mobile,
      email: body.email || null,
      type: body.type,
      productId: productOk ? body.productId : null,
      branchId: branchOk ? body.branchId : null,
      offerId: offerOk ? body.offerId : null,
      message: body.message,
      ipAddress: req.ip?.slice(0, 64) ?? null,
    })
    .returning({ id: inquiries.id });

  res.status(201).json({ ok: true, id: row.id });
});

export default router;
