import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { brands, categories, offers, productImages, products, productVariants } from '../db/schema.js';
import { paginate } from './http.js';
import { boolQuery, csvInts, csvList } from './validation.js';

export const STOCK = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER'] as const;

export const productListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  brand: csvList,
  category: csvList,
  type: z.enum(['MOBILE', 'ACCESSORY']).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  ram: csvInts,
  storage: csvInts,
  availability: csvList.pipe(z.array(z.enum(STOCK))),
  branch: z.string().trim().max(120).optional(),
  featured: boolQuery,
  active: boolQuery,
  exclude: z.coerce.number().int().optional(),
  sort: z.enum(['latest', 'price_asc', 'price_desc', 'name', 'featured']).default('latest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
});
export type ProductListQuery = z.infer<typeof productListQuery>;

export const effectivePrice = sql<number>`coalesce(${products.offerPrice}, ${products.sellingPrice})`;

/** Render a parenthesised, parameterised id list: (1, 2, 3) */
export const idList = (ids: number[]) => sql`(${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

function buildConditions(q: ProductListQuery, opts: { admin: boolean }) {
  const conds: SQL[] = [isNull(products.deletedAt)];
  if (!opts.admin) {
    conds.push(eq(products.isActive, true), eq(brands.isActive, true), eq(categories.isActive, true));
  } else if (q.active !== undefined) {
    conds.push(eq(products.isActive, q.active));
  }
  if (q.search) {
    const term = `%${escapeLike(q.search)}%`;
    conds.push(
      or(
        ilike(products.name, term),
        ilike(products.model, term),
        ilike(products.sku, term),
        ilike(brands.name, term),
        ilike(products.processor, term),
      )!,
    );
  }
  if (q.brand.length) conds.push(inArray(brands.slug, q.brand));
  if (q.category.length) conds.push(inArray(categories.slug, q.category));
  if (q.type) conds.push(eq(categories.type, q.type));
  if (q.minPrice != null) conds.push(gte(effectivePrice, q.minPrice));
  if (q.maxPrice != null) conds.push(lte(effectivePrice, q.maxPrice));
  if (q.ram.length) conds.push(inArray(products.ramGb, q.ram));
  if (q.storage.length) conds.push(inArray(products.storageGb, q.storage));
  if (q.availability.length) conds.push(inArray(products.stockStatus, q.availability));
  if (q.featured !== undefined) conds.push(eq(products.isFeatured, q.featured));
  if (q.exclude) conds.push(sql`${products.id} <> ${q.exclude}`);
  if (q.branch) {
    conds.push(sql`exists (
      select 1 from branch_products bp
      join branches b on b.id = bp.branch_id
      where bp.product_id = ${products.id} and b.slug = ${q.branch}
        and b.is_active = true and b.deleted_at is null)`);
  }
  return and(...conds);
}

function orderFor(sort: ProductListQuery['sort']) {
  switch (sort) {
    case 'price_asc':
      return [asc(effectivePrice), desc(products.id)];
    case 'price_desc':
      return [desc(effectivePrice), desc(products.id)];
    case 'name':
      return [asc(products.name)];
    case 'featured':
      return [desc(products.isFeatured), desc(products.createdAt)];
    default:
      return [desc(products.createdAt), desc(products.id)];
  }
}

export type ProductSummary = Awaited<ReturnType<typeof hydrateSummaries>>[number];

const summaryColumns = {
  id: products.id,
  sku: products.sku,
  name: products.name,
  slug: products.slug,
  model: products.model,
  mrp: products.mrp,
  sellingPrice: products.sellingPrice,
  offerPrice: products.offerPrice,
  ramGb: products.ramGb,
  storageGb: products.storageGb,
  display: products.display,
  camera: products.camera,
  battery: products.battery,
  processor: products.processor,
  stockStatus: products.stockStatus,
  isFeatured: products.isFeatured,
  isActive: products.isActive,
  isDemo: products.isDemo,
  createdAt: products.createdAt,
  brandId: products.brandId,
  brandName: brands.name,
  brandSlug: brands.slug,
  categoryId: products.categoryId,
  categoryName: categories.name,
  categorySlug: categories.slug,
  categoryType: categories.type,
};

type SummaryRow = { [K in keyof typeof summaryColumns]: (typeof summaryColumns)[K]['_']['data'] | null };

async function hydrateSummaries(rows: SummaryRow[]) {
  const ids = rows.map((r) => r.id as number);
  const [imgs, vars] = ids.length
    ? await Promise.all([
        db
          .select({ productId: productImages.productId, url: productImages.url, alt: productImages.alt })
          .from(productImages)
          .where(inArray(productImages.productId, ids))
          .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
        db
          .select({ productId: productVariants.productId, name: productVariants.colorName, hex: productVariants.colorHex })
          .from(productVariants)
          .where(inArray(productVariants.productId, ids))
          .orderBy(asc(productVariants.sortOrder), asc(productVariants.id)),
      ])
    : [[], []];

  return rows.map((r) => {
    const { brandName, brandSlug, categoryName, categorySlug, categoryType, ...rest } = r;
    return {
      ...rest,
      brand: { name: brandName, slug: brandSlug },
      category: { name: categoryName, slug: categorySlug, type: categoryType },
      images: imgs.filter((i) => i.productId === r.id).slice(0, 2).map(({ url, alt }) => ({ url, alt })),
      colors: vars.filter((v) => v.productId === r.id).map(({ name, hex }) => ({ name, hex })),
    };
  });
}

export async function listProducts(q: ProductListQuery, opts: { admin?: boolean } = {}) {
  const where = buildConditions(q, { admin: Boolean(opts.admin) });
  const { limit, offset, page } = paginate(q.page, q.limit);

  const base = () =>
    db
      .select(summaryColumns)
      .from(products)
      .innerJoin(brands, eq(products.brandId, brands.id))
      .innerJoin(categories, eq(products.categoryId, categories.id));

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(where);

  const rows = await base()
    .where(where)
    .orderBy(...orderFor(q.sort))
    .limit(limit)
    .offset(offset);

  const total = countRow?.total ?? 0;
  return {
    items: await hydrateSummaries(rows as SummaryRow[]),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function productSummariesByIds(ids: number[]) {
  if (!ids.length) return [];
  const rows = await db
    .select(summaryColumns)
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(inArray(products.id, ids), isNull(products.deletedAt), eq(products.isActive, true)));
  return hydrateSummaries(rows as SummaryRow[]);
}

/** Price range, RAM/storage options & brand counts for the filter sidebar. */
export async function productFacets(type?: 'MOBILE' | 'ACCESSORY') {
  const conds: SQL[] = [
    isNull(products.deletedAt),
    eq(products.isActive, true),
    eq(brands.isActive, true),
    eq(categories.isActive, true),
  ];
  if (type) conds.push(eq(categories.type, type));
  const where = and(...conds);

  const [range] = await db
    .select({ min: sql<number>`coalesce(min(${effectivePrice}),0)::int`, max: sql<number>`coalesce(max(${effectivePrice}),0)::int` })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(where);

  const ram = await db
    .selectDistinct({ v: products.ramGb })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(where, sql`${products.ramGb} is not null`))
    .orderBy(asc(products.ramGb));

  const storage = await db
    .selectDistinct({ v: products.storageGb })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(where, sql`${products.storageGb} is not null`))
    .orderBy(asc(products.storageGb));

  const brandCounts = await db
    .select({ name: brands.name, slug: brands.slug, count: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(where)
    .groupBy(brands.name, brands.slug, brands.sortOrder)
    .orderBy(asc(brands.sortOrder), asc(brands.name));

  const categoryCounts = await db
    .select({ name: categories.name, slug: categories.slug, count: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(where)
    .groupBy(categories.name, categories.slug, categories.sortOrder)
    .orderBy(asc(categories.sortOrder));

  return {
    price: range ?? { min: 0, max: 0 },
    ram: ram.map((r) => r.v as number),
    storage: storage.map((r) => r.v as number),
    brands: brandCounts,
    categories: categoryCounts,
  };
}

export const activeOfferCondition = () => {
  const now = new Date();
  return and(
    eq(offers.isActive, true),
    isNull(offers.deletedAt),
    or(isNull(offers.validFrom), lte(offers.validFrom, now)),
    or(isNull(offers.validTo), gte(offers.validTo, now)),
  );
};
