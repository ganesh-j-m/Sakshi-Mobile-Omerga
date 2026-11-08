export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER';
export type CategoryType = 'MOBILE' | 'ACCESSORY';
export type InquiryType = 'PRODUCT' | 'BRANCH' | 'OFFER' | 'GENERAL' | 'EXCHANGE' | 'EMI';
export type InquiryStatus = 'NEW' | 'CONTACTED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type OfferType = 'DISCOUNT' | 'CASHBACK' | 'EXCHANGE' | 'EMI' | 'BUNDLE' | 'FESTIVAL';
export type Role = 'SUPER_ADMIN' | 'ADMIN';

export type Pagination = { page: number; limit: number; total: number; totalPages: number };
export type Paginated<T> = { items: T[]; pagination: Pagination };

export type ProductSummary = {
  id: number;
  sku: string;
  name: string;
  slug: string;
  model: string | null;
  mrp: number;
  sellingPrice: number;
  offerPrice: number | null;
  ramGb: number | null;
  storageGb: number | null;
  display: string | null;
  camera: string | null;
  battery: string | null;
  processor: string | null;
  stockStatus: StockStatus;
  isFeatured: boolean;
  isActive: boolean;
  isDemo: boolean;
  brand: { name: string; slug: string };
  category: { name: string; slug: string; type: CategoryType };
  images: { url: string; alt: string | null }[];
  colors: { name: string; hex: string }[];
};

export type ProductImage = { id: number; url: string; alt: string | null; publicId: string | null; sortOrder: number };
export type ProductVariant = { id: number; colorName: string; colorHex: string; imageUrl: string | null; stockStatus: StockStatus };

export type Brand = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  accentColor: string | null;
  isFeatured: boolean;
  isActive?: boolean;
  productCount?: number;
};

export type Category = { id: number; name: string; slug: string; type: CategoryType; icon: string | null; description?: string | null };

export type OpeningHour = { day: string; open: string; close: string; closed?: boolean };

export type Branch = {
  id: number;
  code: string;
  slug: string;
  name: string;
  type: 'MAIN' | 'BRANCH' | 'FRANCHISE' | 'SERVICE_CENTER';
  imageUrl: string | null;
  intro: string | null;
  addressLine: string | null;
  city: string;
  district: string | null;
  state: string;
  pincode: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  openingHours: OpeningHour[];
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  services: string[];
  isDemo: boolean;
};

export type ProductDetail = Omit<ProductSummary, 'images' | 'colors' | 'brand' | 'category'> & {
  description: string | null;
  highlights: string[];
  warranty: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  brand: Brand;
  category: Category;
  images: ProductImage[];
  variants: ProductVariant[];
  availability: {
    stockStatus: StockStatus;
    branchPrice: number | null;
    branch: { id: number; slug: string; name: string; city: string; phone: string | null; whatsapp: string | null; addressLine: string | null };
  }[];
};

export type Offer = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  offerType: OfferType;
  discountType: 'PERCENT' | 'FLAT' | 'NONE';
  discountValue: number | null;
  bannerUrl: string | null;
  badge: string | null;
  validFrom: string | null;
  validTo: string | null;
  terms: string | null;
  isFeatured: boolean;
  isDemo: boolean;
  brand: { name: string; slug: string } | null;
  product: { name: string; slug: string } | null;
  branches: { id: number; name: string; slug: string }[];
};

export type Banner = {
  id: number;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  placement: 'HOME_HERO' | 'HOME_PROMO' | 'OFFERS_PAGE';
  theme: string;
  isDemo: boolean;
};

export type Testimonial = {
  id: number;
  customerName: string;
  location: string | null;
  rating: number;
  message: string;
  avatarUrl: string | null;
  isDemo: boolean;
};

export type GeneralSettings = {
  siteName: string;
  tagline: string;
  defaultWhatsapp: string;
  defaultPhone: string;
  email: string;
  currency: string;
  showDemoBadge: boolean;
};

export type SeoMap = Record<string, { title?: string; description?: string; ogImage?: string }>;

export type SiteData = {
  general: GeneralSettings;
  seo: SeoMap;
  cms: {
    announcement?: { enabled?: boolean; items?: { text: string; link?: string }[] };
    contact?: { heading?: string; phone?: string; whatsapp?: string; email?: string; address?: string; hours?: string; note?: string };
    footer?: { about?: string; copyright?: string; developedBy?: string; developedByUrl?: string };
    social?: { facebook?: string; instagram?: string; youtube?: string; x?: string };
  };
  categories: Category[];
  brands: { name: string; slug: string; logoUrl: string | null; accentColor: string | null }[];
};

export type HomeData = {
  hero: {
    eyebrow?: string;
    headline?: string;
    highlight?: string;
    subheadline?: string;
    primaryCtaLabel?: string;
    primaryCtaLink?: string;
    secondaryCtaLabel?: string;
    badges?: { label: string }[];
  } | null;
  whyChoose: { title?: string; subtitle?: string; items?: { icon: string; title: string; text: string }[] } | null;
  heroBanners: Banner[];
  promoBanners: Banner[];
  brands: Brand[];
  featured: ProductSummary[];
  latest: ProductSummary[];
  accessories: ProductSummary[];
  offers: Offer[];
  branches: Branch[];
  testimonials: Testimonial[];
  stats: { products: number; brands: number; branches: number };
};

export type Facets = {
  price: { min: number; max: number };
  ram: number[];
  storage: number[];
  brands: { name: string; slug: string; count: number }[];
  categories: { name: string; slug: string; count: number }[];
};

export type PermissionFlags = { view: boolean; create: boolean; edit: boolean; delete: boolean };

export type AuthUser = {
  id: number;
  loginId: string;
  email: string | null;
  role: Role;
  name: string;
  designation: string | null;
  permissions: Record<string, PermissionFlags>;
  branchIds: number[] | null;
};

export type Inquiry = {
  id: number;
  customerName: string;
  mobile: string;
  email: string | null;
  type: InquiryType;
  status: InquiryStatus;
  message: string | null;
  remarks: { by: string; at: string; note: string }[];
  createdAt: string;
  updatedAt: string;
  contactedAt: string | null;
  resolvedAt: string | null;
  branchId: number | null;
  branchName: string | null;
  productId: number | null;
  productName: string | null;
  productSlug: string | null;
  offerTitle: string | null;
  handledBy: string | null;
};

/* ─────────────────────────── Billing ─────────────────────────── */

export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'EMI' | 'BANK_TRANSFER' | 'MIXED';
export type BillStatus = 'PAID' | 'PARTIAL' | 'CANCELLED';

export type BillingSettings = {
  businessName: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  invoicePrefix: string;
  defaultGstRate: number;
  defaultHsn: string;
  pricesIncludeGst: boolean;
  terms: string;
  footerNote: string;
};

export type BillItem = {
  id: number;
  productId: number | null;
  description: string;
  sku: string | null;
  hsnCode: string | null;
  serialNumber: string | null;
  quantity: number;
  unitPricePaise: number;
  discountPaise: number;
  gstRate: number;
  taxablePaise: number;
  gstPaise: number;
  lineTotalPaise: number;
};

export type Bill = {
  id: number;
  billNumber: string;
  publicToken?: string;
  billDate: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string | null;
  customerAddress: string | null;
  customerGstin: string | null;
  pricesIncludeGst: boolean;
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  paidPaise: number;
  paymentMode: PaymentMode;
  paymentReference: string | null;
  status: BillStatus;
  notes: string | null;
  whatsappSentAt: string | null;
  whatsappStatus: 'AUTO_SENT' | 'FAILED' | 'MANUAL' | null;
  whatsappError?: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: BillItem[];
  branch: { id: number; code: string; name: string; addressLine: string | null; city: string; district: string | null; state: string; pincode: string | null; phone: string | null; email: string | null };
  createdBy?: { loginId: string } | null;
};
