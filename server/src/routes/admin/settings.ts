import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { env, whatsappApiEnabled } from '../../config/env.js';
import { db } from '../../db/index.js';
import { banners, branches, offers, products, systemSettings, testimonials } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { badRequest, parse } from '../../lib/http.js';
import { DEFAULT_BILLING, DEFAULT_GENERAL, getSetting, type SeoSettings } from '../../lib/settings.js';
import { cleanText } from '../../lib/validation.js';

/** System settings & SEO — mounted behind requireSuperAdmin. */
const router = Router();

const phone = z
  .string()
  .transform((v) => v.replace(/[^\d]/g, ''))
  .refine((v) => v === '' || /^\d{10,13}$/.test(v), 'Enter digits only, with country code e.g. 919800000000');

const generalSchema = z.object({
  siteName: z.string().trim().min(2).max(80).transform(cleanText),
  tagline: z.string().max(160).transform(cleanText),
  defaultWhatsapp: phone,
  defaultPhone: phone,
  email: z.union([z.string().trim().email(), z.literal('')]),
  currency: z.literal('INR').default('INR'),
  showDemoBadge: z.boolean(),
  maintenanceMode: z.boolean(),
});

const seoEntry = z.object({
  title: z.string().max(160).transform(cleanText).optional(),
  description: z.string().max(320).transform(cleanText).optional(),
  ogImage: z.string().max(1000).optional(),
});
const seoSchema = z.record(z.string().regex(/^\/[a-z0-9\-/]*$/i, 'Route must start with /'), seoEntry);

router.get('/', async (_req, res) => {
  const [general, seo, billing] = await Promise.all([
    getSetting('general', DEFAULT_GENERAL),
    getSetting<SeoSettings>('seo', {}),
    getSetting('billing', DEFAULT_BILLING),
  ]);
  res.json({
    general,
    seo,
    billing,
    whatsappApi: { configured: whatsappApiEnabled, templateName: env.WHATSAPP_TEMPLATE_NAME, language: env.WHATSAPP_TEMPLATE_LANG },
  });
});

async function save(key: string, value: Record<string, unknown>, userId: number) {
  await db
    .insert(systemSettings)
    .values({ key, value, updatedById: userId })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedById: userId, updatedAt: new Date() } });
}

router.put('/general', async (req, res) => {
  const value = parse(generalSchema, req.body);
  await save('general', value, req.user!.id);
  await logActivity(req, 'UPDATE', 'settings', 'general');
  res.json({ general: value });
});

router.put('/seo', async (req, res) => {
  const value = parse(seoSchema, req.body);
  if (Object.keys(value).length > 200) throw badRequest('Too many SEO entries');
  await save('seo', value, req.user!.id);
  await logActivity(req, 'UPDATE', 'settings', 'seo');
  res.json({ seo: value });
});

const billingSchema = z.object({
  businessName: z.string().trim().min(2).max(120).transform(cleanText),
  gstin: z.union([z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, 'Invalid GSTIN'), z.literal('')]),
  address: z.string().max(500).transform(cleanText),
  phone: z.string().max(40).transform(cleanText),
  email: z.union([z.string().trim().email(), z.literal('')]),
  invoicePrefix: z.string().trim().min(1).max(8).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers or hyphen'),
  defaultGstRate: z.coerce.number().min(0).max(28),
  defaultHsn: z.string().trim().max(12).regex(/^\d*$/, 'Digits only'),
  pricesIncludeGst: z.boolean(),
  terms: z.string().max(2000).transform(cleanText),
  footerNote: z.string().max(300).transform(cleanText),
});

router.put('/billing', async (req, res) => {
  const value = parse(billingSchema, req.body);
  await save('billing', value, req.user!.id);
  await logActivity(req, 'UPDATE', 'settings', 'billing');
  res.json({ billing: value });
});

/** Remove every record that was seeded as demo data (once real data has been entered). */
router.post('/purge-demo-data', async (req, res) => {
  const { confirm } = parse(z.object({ confirm: z.literal('DELETE DEMO DATA') }), req.body);
  void confirm;
  const result = await db.transaction(async (tx) => {
    const o = await tx.delete(offers).where(eq(offers.isDemo, true)).returning({ id: offers.id });
    const p = await tx.delete(products).where(eq(products.isDemo, true)).returning({ id: products.id });
    const t = await tx.delete(testimonials).where(eq(testimonials.isDemo, true)).returning({ id: testimonials.id });
    const b = await tx.delete(banners).where(eq(banners.isDemo, true)).returning({ id: banners.id });
    // Branches are only un-flagged (the Omerga branch is real; its details just need verifying)
    const br = await tx.update(branches).set({ isDemo: false }).where(eq(branches.isDemo, true)).returning({ id: branches.id });
    return { offers: o.length, products: p.length, testimonials: t.length, banners: b.length, branchesVerified: br.length };
  });
  await logActivity(req, 'PURGE_DEMO', 'settings', null, result);
  res.json({ ok: true, removed: result });
});

export default router;
