import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { cmsPages, systemSettings } from '../db/schema.js';

export type GeneralSettings = {
  siteName: string;
  tagline: string;
  defaultWhatsapp: string;
  defaultPhone: string;
  email: string;
  currency: string;
  showDemoBadge: boolean;
  maintenanceMode: boolean;
};

export const DEFAULT_GENERAL: GeneralSettings = {
  siteName: 'Sakshi Mobile',
  tagline: 'Smartphones & accessories in Omerga',
  defaultWhatsapp: '',
  defaultPhone: '',
  email: '',
  currency: 'INR',
  showDemoBadge: true,
  maintenanceMode: false,
};

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

/** No GSTIN / rate is assumed — the owner enters verified values in System Settings. */
export const DEFAULT_BILLING: BillingSettings = {
  businessName: 'Sakshi Mobile',
  gstin: '',
  address: '',
  phone: '',
  email: '',
  invoicePrefix: 'SM',
  defaultGstRate: 0,
  defaultHsn: '',
  pricesIncludeGst: true,
  terms: 'Goods once sold will not be taken back. Warranty as per manufacturer terms.',
  footerNote: 'Thank you for shopping with us!',
};

export type SeoEntry = { title?: string; description?: string; ogImage?: string };
export type SeoSettings = Record<string, SeoEntry>;

export async function getSetting<T extends object>(key: string, fallback: T): Promise<T> {
  const row = await db.query.systemSettings.findFirst({ where: eq(systemSettings.key, key) });
  return { ...fallback, ...((row?.value as Partial<T>) ?? {}) };
}

export async function getCmsMap(keys: string[]) {
  const rows = await db.select().from(cmsPages).where(inArray(cmsPages.key, keys));
  return Object.fromEntries(rows.map((r) => [r.key, r.content])) as Record<string, Record<string, unknown>>;
}
