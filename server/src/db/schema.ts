import { relations } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

/* ───────────────────────────── Enums ───────────────────────────── */

export const roleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'ADMIN']);
export const stockStatusEnum = pgEnum('stock_status', ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER']);
export const categoryTypeEnum = pgEnum('category_type', ['MOBILE', 'ACCESSORY']);
export const branchTypeEnum = pgEnum('branch_type', ['MAIN', 'BRANCH', 'FRANCHISE', 'SERVICE_CENTER']);
export const inquiryTypeEnum = pgEnum('inquiry_type', ['PRODUCT', 'BRANCH', 'OFFER', 'GENERAL', 'EXCHANGE', 'EMI']);
export const inquiryStatusEnum = pgEnum('inquiry_status', ['NEW', 'CONTACTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
export const offerTypeEnum = pgEnum('offer_type', ['DISCOUNT', 'CASHBACK', 'EXCHANGE', 'EMI', 'BUNDLE', 'FESTIVAL']);
export const discountTypeEnum = pgEnum('discount_type', ['PERCENT', 'FLAT', 'NONE']);
export const bannerPlacementEnum = pgEnum('banner_placement', ['HOME_HERO', 'HOME_PROMO', 'OFFERS_PAGE']);

/* ─────────────────────────── Shared cols ────────────────────────── */

const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
const softDelete = () => ({ deletedAt: timestamp('deleted_at', { withTimezone: true }) });

/* ─────────────────────────── Users & admin ──────────────────────── */

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    loginId: varchar('login_id', { length: 64 }).notNull(),
    email: varchar('email', { length: 255 }),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull().default('ADMIN'),
    isActive: boolean('is_active').notNull().default(true),
    tokenVersion: integer('token_version').notNull().default(0),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [uniqueIndex('users_login_id_uq').on(t.loginId), index('users_role_idx').on(t.role)],
);

export const adminProfiles = pgTable('admin_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  designation: varchar('designation', { length: 120 }),
  avatarUrl: text('avatar_url'),
  ...timestamps(),
});

/** One row per (admin, module). SUPER_ADMIN bypasses these checks. */
export const adminPermissions = pgTable(
  'admin_permissions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    module: varchar('module', { length: 40 }).notNull(),
    canView: boolean('can_view').notNull().default(true),
    canCreate: boolean('can_create').notNull().default(false),
    canEdit: boolean('can_edit').notNull().default(false),
    canDelete: boolean('can_delete').notNull().default(false),
    ...timestamps(),
  },
  (t) => [uniqueIndex('admin_permissions_user_module_uq').on(t.userId, t.module)],
);

/** Branches an ADMIN is allowed to manage. */
export const adminBranches = pgTable(
  'admin_branches',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('admin_branches_uq').on(t.userId, t.branchId)],
);

/* ──────────────────────────── Catalogue ─────────────────────────── */

export type OpeningHour = { day: string; open: string; close: string; closed?: boolean };

export const branches = pgTable(
  'branches',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 20 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    type: branchTypeEnum('type').notNull().default('BRANCH'),
    imageUrl: text('image_url'),
    intro: text('intro'),
    addressLine: text('address_line'),
    city: varchar('city', { length: 80 }).notNull(),
    district: varchar('district', { length: 80 }),
    state: varchar('state', { length: 80 }).notNull().default('Maharashtra'),
    pincode: varchar('pincode', { length: 10 }),
    phone: varchar('phone', { length: 20 }),
    whatsapp: varchar('whatsapp', { length: 20 }),
    email: varchar('email', { length: 255 }),
    openingHours: jsonb('opening_hours').$type<OpeningHour[]>().notNull().default([]),
    mapsUrl: text('maps_url'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    services: jsonb('services').$type<string[]>().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    uniqueIndex('branches_code_uq').on(t.code),
    uniqueIndex('branches_slug_uq').on(t.slug),
    index('branches_active_idx').on(t.isActive),
  ],
);

export const brands = pgTable(
  'brands',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),
    description: text('description'),
    accentColor: varchar('accent_color', { length: 9 }),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [uniqueIndex('brands_name_uq').on(t.name), uniqueIndex('brands_slug_uq').on(t.slug)],
);

/** Brands available at a branch (normalised many-to-many). */
export const branchBrands = pgTable(
  'branch_brands',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    brandId: integer('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('branch_brands_uq').on(t.branchId, t.brandId)],
);

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    type: categoryTypeEnum('type').notNull().default('MOBILE'),
    description: text('description'),
    imageUrl: text('image_url'),
    icon: varchar('icon', { length: 40 }),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [uniqueIndex('categories_slug_uq').on(t.slug), index('categories_type_idx').on(t.type)],
);

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    sku: varchar('sku', { length: 40 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 220 }).notNull(),
    brandId: integer('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    model: varchar('model', { length: 120 }),
    /** Prices are stored in whole Indian Rupees. */
    mrp: integer('mrp').notNull(),
    sellingPrice: integer('selling_price').notNull(),
    offerPrice: integer('offer_price'),
    ramGb: integer('ram_gb'),
    storageGb: integer('storage_gb'),
    display: varchar('display', { length: 160 }),
    camera: varchar('camera', { length: 200 }),
    battery: varchar('battery', { length: 120 }),
    processor: varchar('processor', { length: 160 }),
    description: text('description'),
    highlights: jsonb('highlights').$type<string[]>().notNull().default([]),
    warranty: varchar('warranty', { length: 200 }),
    stockStatus: stockStatusEnum('stock_status').notNull().default('IN_STOCK'),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    metaTitle: varchar('meta_title', { length: 160 }),
    metaDescription: varchar('meta_description', { length: 320 }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    uniqueIndex('products_sku_uq').on(t.sku),
    uniqueIndex('products_slug_uq').on(t.slug),
    index('products_brand_idx').on(t.brandId),
    index('products_category_idx').on(t.categoryId),
    index('products_price_idx').on(t.sellingPrice),
    index('products_featured_idx').on(t.isFeatured),
    index('products_stock_idx').on(t.stockStatus),
    index('products_created_idx').on(t.createdAt),
  ],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    colorName: varchar('color_name', { length: 60 }).notNull(),
    colorHex: varchar('color_hex', { length: 9 }).notNull().default('#111827'),
    imageUrl: text('image_url'),
    stockStatus: stockStatusEnum('stock_status').notNull().default('IN_STOCK'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('product_variants_product_idx').on(t.productId),
    uniqueIndex('product_variants_color_uq').on(t.productId, t.colorName),
  ],
);

export const productImages = pgTable(
  'product_images',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    url: text('url').notNull(),
    publicId: text('public_id'),
    alt: varchar('alt', { length: 200 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('product_images_product_idx').on(t.productId)],
);

export const branchProducts = pgTable(
  'branch_products',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    stockStatus: stockStatusEnum('stock_status').notNull().default('IN_STOCK'),
    branchPrice: integer('branch_price'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('branch_products_uq').on(t.branchId, t.productId),
    index('branch_products_product_idx').on(t.productId),
  ],
);

/* ───────────────────────────── Offers ───────────────────────────── */

export const offers = pgTable(
  'offers',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 160 }).notNull(),
    slug: varchar('slug', { length: 180 }).notNull(),
    description: text('description'),
    offerType: offerTypeEnum('offer_type').notNull().default('DISCOUNT'),
    discountType: discountTypeEnum('discount_type').notNull().default('NONE'),
    discountValue: integer('discount_value'),
    bannerUrl: text('banner_url'),
    badge: varchar('badge', { length: 40 }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    brandId: integer('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    terms: text('terms'),
    isFeatured: boolean('is_featured').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [uniqueIndex('offers_slug_uq').on(t.slug), index('offers_active_idx').on(t.isActive, t.validTo)],
);

export const branchOffers = pgTable(
  'branch_offers',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    offerId: integer('offer_id')
      .notNull()
      .references(() => offers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('branch_offers_uq').on(t.branchId, t.offerId)],
);

/* ──────────────────────────── Inquiries ─────────────────────────── */

export type InquiryRemark = { by: string; at: string; note: string };

export const inquiries = pgTable(
  'inquiries',
  {
    id: serial('id').primaryKey(),
    customerName: varchar('customer_name', { length: 120 }).notNull(),
    mobile: varchar('mobile', { length: 15 }).notNull(),
    email: varchar('email', { length: 255 }),
    type: inquiryTypeEnum('type').notNull().default('GENERAL'),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    offerId: integer('offer_id').references(() => offers.id, { onDelete: 'set null' }),
    message: text('message'),
    status: inquiryStatusEnum('status').notNull().default('NEW'),
    remarks: jsonb('remarks').$type<InquiryRemark[]>().notNull().default([]),
    handledById: integer('handled_by_id').references(() => users.id, { onDelete: 'set null' }),
    contactedAt: timestamp('contacted_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ipAddress: varchar('ip_address', { length: 64 }),
    ...timestamps(),
  },
  (t) => [
    index('inquiries_status_idx').on(t.status),
    index('inquiries_branch_idx').on(t.branchId),
    index('inquiries_type_idx').on(t.type),
    index('inquiries_created_idx').on(t.createdAt),
  ],
);

/* ─────────────────────────────── CMS ────────────────────────────── */

export const testimonials = pgTable('testimonials', {
  id: serial('id').primaryKey(),
  customerName: varchar('customer_name', { length: 120 }).notNull(),
  location: varchar('location', { length: 120 }),
  rating: integer('rating').notNull().default(5),
  message: text('message').notNull(),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').notNull().default(true),
  isDemo: boolean('is_demo').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps(),
});

export const banners = pgTable(
  'banners',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 160 }).notNull(),
    subtitle: text('subtitle'),
    imageUrl: text('image_url'),
    mobileImageUrl: text('mobile_image_url'),
    ctaLabel: varchar('cta_label', { length: 60 }),
    ctaLink: varchar('cta_link', { length: 300 }),
    placement: bannerPlacementEnum('placement').notNull().default('HOME_PROMO'),
    theme: varchar('theme', { length: 20 }).notNull().default('blue'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('banners_placement_idx').on(t.placement, t.isActive)],
);

export const cmsPages = pgTable(
  'cms_pages',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 60 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
    metaTitle: varchar('meta_title', { length: 160 }),
    metaDescription: varchar('meta_description', { length: 320 }),
    updatedById: integer('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [uniqueIndex('cms_pages_key_uq').on(t.key)],
);

/* ─────────────────────────── System ─────────────────────────────── */

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 60 }).notNull(),
    entity: varchar('entity', { length: 60 }).notNull(),
    entityId: varchar('entity_id', { length: 60 }),
    details: jsonb('details').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('activity_logs_created_idx').on(t.createdAt),
    index('activity_logs_user_idx').on(t.userId),
    index('activity_logs_entity_idx').on(t.entity),
  ],
);

export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 60 }).primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull().default({}),
  updatedById: integer('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

/* ─────────────────────────── Relations ──────────────────────────── */

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(adminProfiles, { fields: [users.id], references: [adminProfiles.userId] }),
  permissions: many(adminPermissions),
  branches: many(adminBranches),
}));
export const adminProfilesRelations = relations(adminProfiles, ({ one }) => ({
  user: one(users, { fields: [adminProfiles.userId], references: [users.id] }),
}));
export const adminPermissionsRelations = relations(adminPermissions, ({ one }) => ({
  user: one(users, { fields: [adminPermissions.userId], references: [users.id] }),
}));
export const adminBranchesRelations = relations(adminBranches, ({ one }) => ({
  user: one(users, { fields: [adminBranches.userId], references: [users.id] }),
  branch: one(branches, { fields: [adminBranches.branchId], references: [branches.id] }),
}));
export const branchesRelations = relations(branches, ({ many }) => ({
  branchProducts: many(branchProducts),
  branchOffers: many(branchOffers),
  branchBrands: many(branchBrands),
}));
export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
  branchBrands: many(branchBrands),
}));
export const branchBrandsRelations = relations(branchBrands, ({ one }) => ({
  branch: one(branches, { fields: [branchBrands.branchId], references: [branches.id] }),
  brand: one(brands, { fields: [branchBrands.brandId], references: [brands.id] }),
}));
export const categoriesRelations = relations(categories, ({ many }) => ({ products: many(products) }));
export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  variants: many(productVariants),
  branchProducts: many(branchProducts),
}));
export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
export const branchProductsRelations = relations(branchProducts, ({ one }) => ({
  branch: one(branches, { fields: [branchProducts.branchId], references: [branches.id] }),
  product: one(products, { fields: [branchProducts.productId], references: [products.id] }),
}));
export const offersRelations = relations(offers, ({ one, many }) => ({
  product: one(products, { fields: [offers.productId], references: [products.id] }),
  brand: one(brands, { fields: [offers.brandId], references: [brands.id] }),
  branchOffers: many(branchOffers),
}));
export const branchOffersRelations = relations(branchOffers, ({ one }) => ({
  branch: one(branches, { fields: [branchOffers.branchId], references: [branches.id] }),
  offer: one(offers, { fields: [branchOffers.offerId], references: [offers.id] }),
}));
export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  product: one(products, { fields: [inquiries.productId], references: [products.id] }),
  branch: one(branches, { fields: [inquiries.branchId], references: [branches.id] }),
  offer: one(offers, { fields: [inquiries.offerId], references: [offers.id] }),
  handledBy: one(users, { fields: [inquiries.handledById], references: [users.id] }),
}));
export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, { fields: [activityLogs.userId], references: [users.id] }),
}));

/* ─────────────────────────── Billing (POS) ─────────────────────────── */

export const paymentModeEnum = pgEnum('payment_mode', ['CASH', 'UPI', 'CARD', 'EMI', 'BANK_TRANSFER', 'MIXED']);
export const billStatusEnum = pgEnum('bill_status', ['PAID', 'PARTIAL', 'CANCELLED']);

/** Sequential invoice numbers per branch per Indian financial year (Apr–Mar). */
export const billCounters = pgTable(
  'bill_counters',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    financialYear: varchar('financial_year', { length: 9 }).notNull(),
    lastNumber: integer('last_number').notNull().default(0),
  },
  (t) => [uniqueIndex('bill_counters_uq').on(t.branchId, t.financialYear)],
);

/** All money columns are stored in PAISE (₹1 = 100) to avoid rounding errors. */
export const bills = pgTable(
  'bills',
  {
    id: serial('id').primaryKey(),
    billNumber: varchar('bill_number', { length: 60 }).notNull(),
    /** Unguessable token for the customer's public bill link */
    publicToken: varchar('public_token', { length: 40 }).notNull(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    billDate: timestamp('bill_date', { withTimezone: true }).defaultNow().notNull(),
    customerName: varchar('customer_name', { length: 120 }).notNull(),
    customerMobile: varchar('customer_mobile', { length: 15 }).notNull(),
    customerEmail: varchar('customer_email', { length: 255 }),
    customerAddress: text('customer_address'),
    customerGstin: varchar('customer_gstin', { length: 15 }),
    pricesIncludeGst: boolean('prices_include_gst').notNull().default(true),
    subtotalPaise: integer('subtotal_paise').notNull(),
    discountPaise: integer('discount_paise').notNull().default(0),
    taxablePaise: integer('taxable_paise').notNull(),
    cgstPaise: integer('cgst_paise').notNull().default(0),
    sgstPaise: integer('sgst_paise').notNull().default(0),
    roundOffPaise: integer('round_off_paise').notNull().default(0),
    totalPaise: integer('total_paise').notNull(),
    paidPaise: integer('paid_paise').notNull(),
    paymentMode: paymentModeEnum('payment_mode').notNull().default('CASH'),
    paymentReference: varchar('payment_reference', { length: 120 }),
    status: billStatusEnum('status').notNull().default('PAID'),
    notes: text('notes'),
    createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    whatsappSentAt: timestamp('whatsapp_sent_at', { withTimezone: true }),
    /** AUTO_SENT | FAILED | MANUAL — how the bill reached the customer on WhatsApp */
    whatsappStatus: varchar('whatsapp_status', { length: 20 }),
    whatsappMessageId: varchar('whatsapp_message_id', { length: 120 }),
    whatsappError: varchar('whatsapp_error', { length: 300 }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    cancelledById: integer('cancelled_by_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('bills_number_uq').on(t.billNumber),
    uniqueIndex('bills_token_uq').on(t.publicToken),
    index('bills_branch_date_idx').on(t.branchId, t.billDate),
    index('bills_mobile_idx').on(t.customerMobile),
    index('bills_status_idx').on(t.status),
  ],
);

export const billItems = pgTable(
  'bill_items',
  {
    id: serial('id').primaryKey(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    description: varchar('description', { length: 250 }).notNull(),
    sku: varchar('sku', { length: 40 }),
    hsnCode: varchar('hsn_code', { length: 12 }),
    serialNumber: varchar('serial_number', { length: 120 }),
    quantity: integer('quantity').notNull(),
    unitPricePaise: integer('unit_price_paise').notNull(),
    discountPaise: integer('discount_paise').notNull().default(0),
    gstRate: doublePrecision('gst_rate').notNull().default(0),
    taxablePaise: integer('taxable_paise').notNull(),
    gstPaise: integer('gst_paise').notNull(),
    lineTotalPaise: integer('line_total_paise').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('bill_items_bill_idx').on(t.billId), index('bill_items_serial_idx').on(t.serialNumber)],
);

export const billsRelations = relations(bills, ({ one, many }) => ({
  branch: one(branches, { fields: [bills.branchId], references: [branches.id] }),
  items: many(billItems),
  createdBy: one(users, { fields: [bills.createdById], references: [users.id] }),
}));
export const billItemsRelations = relations(billItems, ({ one }) => ({
  bill: one(bills, { fields: [billItems.billId], references: [bills.id] }),
  product: one(products, { fields: [billItems.productId], references: [products.id] }),
}));
