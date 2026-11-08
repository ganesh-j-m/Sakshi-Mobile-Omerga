import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { banners, brands, categories, productVariants, testimonials } from '../../db/schema.js';
import { hexColor, optDate, optText, optUrl, requiredText } from '../../lib/validation.js';
import { crudRouter } from './crud.js';

const sortOrder = z.coerce.number().int().min(0).max(100000).default(0);

export const brandsRouter = crudRouter({
  table: brands as never,
  entity: 'brand',
  module: 'BRANDS',
  softDelete: true,
  slugFrom: 'name',
  releaseOnDelete: ['slug', 'name'],
  searchColumns: [brands.name, brands.slug],
  schema: z.object({
    name: requiredText(80),
    slug: z.string().max(100).optional().default(''),
    logoUrl: optUrl,
    bannerUrl: optUrl,
    description: optText(2000),
    accentColor: z.union([hexColor, z.literal(''), z.null()]).optional().transform((v) => v || null),
    isFeatured: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder,
  }),
});

export const categoriesRouter = crudRouter({
  table: categories as never,
  entity: 'category',
  module: 'CATEGORIES',
  softDelete: true,
  slugFrom: 'name',
  releaseOnDelete: ['slug'],
  searchColumns: [categories.name, categories.slug],
  filters: (q) => (q.type === 'MOBILE' || q.type === 'ACCESSORY' ? [eq(categories.type, q.type)] : []),
  schema: z.object({
    name: requiredText(80),
    slug: z.string().max(100).optional().default(''),
    type: z.enum(['MOBILE', 'ACCESSORY']).default('MOBILE'),
    description: optText(1000),
    imageUrl: optUrl,
    icon: optText(40),
    isActive: z.boolean().default(true),
    sortOrder,
  }),
});

export const testimonialsRouter = crudRouter({
  table: testimonials as never,
  entity: 'testimonial',
  module: 'TESTIMONIALS',
  searchColumns: [testimonials.customerName, testimonials.message],
  schema: z.object({
    customerName: requiredText(120, 2),
    location: optText(120),
    rating: z.coerce.number().int().min(1).max(5).default(5),
    message: requiredText(1000, 5),
    avatarUrl: optUrl,
    isActive: z.boolean().default(true),
    sortOrder,
  }),
});

export const bannersRouter = crudRouter({
  table: banners as never,
  entity: 'banner',
  module: 'BANNERS',
  searchColumns: [banners.title],
  filters: (q) =>
    typeof q.placement === 'string' && ['HOME_HERO', 'HOME_PROMO', 'OFFERS_PAGE'].includes(q.placement)
      ? [eq(banners.placement, q.placement as 'HOME_HERO')]
      : [],
  schema: z.object({
    title: requiredText(160),
    subtitle: optText(500),
    imageUrl: optUrl,
    mobileImageUrl: optUrl,
    ctaLabel: optText(60),
    ctaLink: optUrl,
    placement: z.enum(['HOME_HERO', 'HOME_PROMO', 'OFFERS_PAGE']).default('HOME_PROMO'),
    theme: z.enum(['blue', 'purple', 'orange', 'navy', 'pink', 'green']).default('blue'),
    startsAt: optDate,
    endsAt: optDate,
    isActive: z.boolean().default(true),
    sortOrder,
  }),
});

export const variantsRouter = crudRouter({
  table: productVariants as never,
  entity: 'product_variant',
  module: 'PRODUCTS',
  searchColumns: [productVariants.colorName],
  filters: (q) => (q.productId && Number(q.productId) > 0 ? [eq(productVariants.productId, Number(q.productId))] : []),
  schema: z.object({
    productId: z.coerce.number().int().positive(),
    colorName: requiredText(60),
    colorHex: hexColor,
    imageUrl: optUrl,
    stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER']).default('IN_STOCK'),
    sortOrder,
  }),
});
