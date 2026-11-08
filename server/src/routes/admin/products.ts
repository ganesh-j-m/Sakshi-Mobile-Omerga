import { Router } from 'express';
import { and, asc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { branches, branchProducts, brands, categories, productImages, products, productVariants } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { listProducts, productListQuery, STOCK } from '../../lib/catalog.js';
import { badRequest, notFound, parse, toId } from '../../lib/http.js';
import { slugify } from '../../lib/slug.js';
import { deleteImage } from '../../lib/storage.js';
import { hexColor, optInt, optText, optUrl, requiredText } from '../../lib/validation.js';
import { assertBranchAccess, branchScope, requirePermission, type AuthUser } from '../../middleware/auth.js';

const router = Router();

const imageSchema = z.object({
  url: z.string().min(1).max(1000).refine((v) => /^(https?:\/\/|\/)/.test(v), 'Invalid image URL'),
  publicId: z.string().max(300).nullable().optional(),
  alt: optText(200),
});

const variantSchema = z.object({
  id: z.number().int().positive().optional(),
  colorName: requiredText(60),
  colorHex: hexColor,
  imageUrl: optUrl,
  stockStatus: z.enum(STOCK).default('IN_STOCK'),
});

const availabilitySchema = z.object({
  branchId: z.number().int().positive(),
  stockStatus: z.enum(STOCK).default('IN_STOCK'),
  branchPrice: optInt,
});

const baseProduct = z.object({
  sku: requiredText(40).transform((v) => v.toUpperCase().replace(/\s+/g, '-')),
  name: requiredText(200, 2),
  slug: z.string().max(220).optional().default(''),
  brandId: z.coerce.number().int().positive('Select a brand'),
  categoryId: z.coerce.number().int().positive('Select a category'),
  model: optText(120),
  mrp: z.coerce.number().int().positive('MRP must be greater than 0'),
  sellingPrice: z.coerce.number().int().positive('Selling price must be greater than 0'),
  offerPrice: optInt,
  ramGb: optInt,
  storageGb: optInt,
  display: optText(160),
  camera: optText(200),
  battery: optText(120),
  processor: optText(160),
  description: optText(8000),
  highlights: z.array(z.string().trim().max(160)).max(12).default([]),
  warranty: optText(200),
  stockStatus: z.enum(STOCK).default('IN_STOCK'),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metaTitle: optText(160),
  metaDescription: optText(320),
  images: z.array(imageSchema).max(12).default([]),
  variants: z.array(variantSchema).max(16).default([]),
  branchAvailability: z.array(availabilitySchema).max(500).optional(),
});

const productSchema = baseProduct
  .refine((p) => p.sellingPrice <= p.mrp, { message: 'Selling price cannot exceed MRP', path: ['sellingPrice'] })
  .refine((p) => p.offerPrice == null || p.offerPrice <= p.sellingPrice, {
    message: 'Offer price cannot exceed selling price',
    path: ['offerPrice'],
  })
  .refine((p) => new Set(p.variants.map((v) => v.colorName.toLowerCase())).size === p.variants.length, {
    message: 'Colour names must be unique',
    path: ['variants'],
  });

type ProductInput = z.infer<typeof productSchema>;

/** Form dropdown data — branches limited to the admin's scope. */
router.get('/options', requirePermission('PRODUCTS', 'view'), async (req, res) => {
  const scope = branchScope(req.user);
  const [brandRows, categoryRows, branchRows] = await Promise.all([
    db.select({ id: brands.id, name: brands.name, slug: brands.slug }).from(brands).where(isNull(brands.deletedAt)).orderBy(asc(brands.name)),
    db
      .select({ id: categories.id, name: categories.name, type: categories.type })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(asc(categories.sortOrder)),
    db
      .select({ id: branches.id, name: branches.name, code: branches.code })
      .from(branches)
      .where(and(isNull(branches.deletedAt), scope === null ? undefined : inArray(branches.id, scope.length ? scope : [0])))
      .orderBy(asc(branches.sortOrder)),
  ]);
  res.json({ brands: brandRows, categories: categoryRows, branches: branchRows });
});

router.get('/', requirePermission('PRODUCTS', 'view'), async (req, res) => {
  const q = parse(productListQuery.extend({ limit: z.coerce.number().int().min(1).max(100).default(20) }), req.query);
  res.json(await listProducts(q, { admin: true }));
});

router.get('/:id', requirePermission('PRODUCTS', 'view'), async (req, res) => {
  const id = toId(req.params.id);
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, id), isNull(products.deletedAt)),
    with: {
      images: { orderBy: (t, o) => [o.asc(t.sortOrder)] },
      variants: { orderBy: (t, o) => [o.asc(t.sortOrder)] },
      branchProducts: true,
      brand: { columns: { name: true, slug: true } },
      category: { columns: { name: true, slug: true, type: true } },
    },
  });
  if (!product) throw notFound('Product');
  res.json({ item: product });
});

async function syncChildren(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productId: number,
  input: ProductInput,
  user: AuthUser,
  isCreate: boolean,
) {
  // Images: replace set, delete removed Cloudinary assets afterwards
  const oldImages = isCreate ? [] : await tx.select().from(productImages).where(eq(productImages.productId, productId));
  await tx.delete(productImages).where(eq(productImages.productId, productId));
  if (input.images.length) {
    await tx.insert(productImages).values(
      input.images.map((img, i) => ({
        productId,
        url: img.url,
        publicId: img.publicId ?? null,
        alt: img.alt ?? input.name,
        sortOrder: i,
      })),
    );
  }
  const keep = new Set(input.images.map((i) => i.publicId).filter(Boolean));
  const removedAssets = oldImages.filter((o) => o.publicId && !keep.has(o.publicId)).map((o) => o.publicId);

  // Variants: update existing by id, insert new, delete missing
  const keepIds = input.variants.map((v) => v.id).filter((v): v is number => Boolean(v));
  await tx
    .delete(productVariants)
    .where(
      and(eq(productVariants.productId, productId), keepIds.length ? notInArray(productVariants.id, keepIds) : undefined),
    );
  for (const [i, v] of input.variants.entries()) {
    const values = { colorName: v.colorName, colorHex: v.colorHex, imageUrl: v.imageUrl, stockStatus: v.stockStatus, sortOrder: i };
    if (v.id) {
      await tx
        .update(productVariants)
        .set(values)
        .where(and(eq(productVariants.id, v.id), eq(productVariants.productId, productId)));
    } else {
      await tx.insert(productVariants).values({ ...values, productId });
    }
  }

  // Branch availability: only touch branches the user manages
  if (input.branchAvailability) {
    const scope = user.branchIds;
    for (const a of input.branchAvailability) assertBranchAccess(user, a.branchId);
    const submitted = input.branchAvailability.map((a) => a.branchId);
    await tx
      .delete(branchProducts)
      .where(
        and(
          eq(branchProducts.productId, productId),
          scope === null ? undefined : inArray(branchProducts.branchId, scope.length ? scope : [0]),
          submitted.length ? notInArray(branchProducts.branchId, submitted) : undefined,
        ),
      );
    for (const a of input.branchAvailability) {
      await tx
        .insert(branchProducts)
        .values({ productId, branchId: a.branchId, stockStatus: a.stockStatus, branchPrice: a.branchPrice })
        .onConflictDoUpdate({
          target: [branchProducts.branchId, branchProducts.productId],
          set: { stockStatus: a.stockStatus, branchPrice: a.branchPrice, updatedAt: new Date() },
        });
    }
  }
  return removedAssets;
}

function productValues(input: ProductInput) {
  const { images: _i, variants: _v, branchAvailability: _b, ...rest } = input;
  return { ...rest, slug: slugify(rest.slug || `${rest.name}`) };
}

router.post('/', requirePermission('PRODUCTS', 'create'), async (req, res) => {
  const input = parse(productSchema, req.body);
  const values = productValues(input);
  if (!values.slug) throw badRequest('Could not generate a URL slug from the name');
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(products).values(values).returning({ id: products.id });
    await syncChildren(tx, row.id, input, req.user!, true);
    return row.id;
  });
  await logActivity(req, 'CREATE', 'product', id, { name: input.name, sku: input.sku });
  res.status(201).json({ id });
});

router.put('/:id', requirePermission('PRODUCTS', 'edit'), async (req, res) => {
  const id = toId(req.params.id);
  const input = parse(productSchema, req.body);
  const existing = await db.query.products.findFirst({ where: and(eq(products.id, id), isNull(products.deletedAt)) });
  if (!existing) throw notFound('Product');
  const removed = await db.transaction(async (tx) => {
    await tx.update(products).set(productValues(input)).where(eq(products.id, id));
    return syncChildren(tx, id, input, req.user!, false);
  });
  await Promise.all(removed.map((p) => deleteImage(p)));
  await logActivity(req, 'UPDATE', 'product', id, { name: input.name });
  res.json({ id });
});

router.patch('/:id/flags', requirePermission('PRODUCTS', 'edit'), async (req, res) => {
  const id = toId(req.params.id);
  const body = parse(
    z.object({ isActive: z.boolean().optional(), isFeatured: z.boolean().optional(), stockStatus: z.enum(STOCK).optional() }),
    req.body,
  );
  if (!Object.keys(body).length) throw badRequest('Nothing to update');
  const [row] = await db
    .update(products)
    .set(body)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .returning({ id: products.id });
  if (!row) throw notFound('Product');
  await logActivity(req, 'UPDATE_FLAGS', 'product', id, body);
  res.json({ ok: true });
});

router.delete('/:id', requirePermission('PRODUCTS', 'delete'), async (req, res) => {
  const id = toId(req.params.id);
  const [row] = await db
    .update(products)
    .set({
      deletedAt: new Date(),
      isActive: false,
      isFeatured: false,
      sku: sql`left(${products.sku}, 20) || '~del-' || ${products.id}`,
      slug: sql`left(${products.slug}, 150) || '~deleted-' || ${products.id}`,
    })
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .returning({ id: products.id });
  if (!row) throw notFound('Product');
  await db.delete(branchProducts).where(eq(branchProducts.productId, id));
  await logActivity(req, 'DELETE', 'product', id);
  res.json({ ok: true });
});

export default router;
