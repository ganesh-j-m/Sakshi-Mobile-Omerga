import { Router } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/index.js';
import { branches, brands, offers, products } from '../db/schema.js';

const router = Router();

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

router.get('/sitemap.xml', async (_req, res) => {
  const base = env.PUBLIC_SITE_URL.replace(/\/$/, '');
  const [productRows, brandRows, branchRows, offerRows] = await Promise.all([
    db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(and(eq(products.isActive, true), isNull(products.deletedAt))),
    db.select({ slug: brands.slug, updatedAt: brands.updatedAt }).from(brands).where(and(eq(brands.isActive, true), isNull(brands.deletedAt))),
    db.select({ slug: branches.slug, updatedAt: branches.updatedAt }).from(branches).where(and(eq(branches.isActive, true), isNull(branches.deletedAt))),
    db.select({ updatedAt: offers.updatedAt }).from(offers).where(and(eq(offers.isActive, true), isNull(offers.deletedAt))),
  ]);

  const latest = (rows: { updatedAt: Date }[]) =>
    rows.reduce<Date | null>((m, r) => (!m || r.updatedAt > m ? r.updatedAt : m), null);

  const urls: { loc: string; lastmod?: Date | null; priority: string; freq: string }[] = [
    { loc: '/', priority: '1.0', freq: 'daily', lastmod: latest(productRows) },
    { loc: '/mobiles', priority: '0.9', freq: 'daily', lastmod: latest(productRows) },
    { loc: '/accessories', priority: '0.8', freq: 'weekly' },
    { loc: '/brands', priority: '0.7', freq: 'weekly', lastmod: latest(brandRows) },
    { loc: '/offers', priority: '0.8', freq: 'daily', lastmod: latest(offerRows) },
    { loc: '/compare', priority: '0.4', freq: 'monthly' },
    { loc: '/branches', priority: '0.8', freq: 'weekly', lastmod: latest(branchRows) },
    { loc: '/about', priority: '0.5', freq: 'monthly' },
    { loc: '/contact', priority: '0.6', freq: 'monthly' },
    { loc: '/privacy-policy', priority: '0.2', freq: 'yearly' },
    { loc: '/terms-and-conditions', priority: '0.2', freq: 'yearly' },
    ...productRows.map((p) => ({ loc: `/mobiles/${p.slug}`, lastmod: p.updatedAt, priority: '0.8', freq: 'weekly' })),
    ...brandRows.map((b) => ({ loc: `/brands/${b.slug}`, lastmod: b.updatedAt, priority: '0.6', freq: 'weekly' })),
    ...branchRows.map((b) => ({ loc: `/branches/${b.slug}`, lastmod: b.updatedAt, priority: '0.7', freq: 'monthly' })),
  ];

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${xmlEscape(base + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ''}<changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`,
    )
    .join('\n');

  res.type('application/xml').set('Cache-Control', 'public, max-age=3600');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`);
});

router.get('/robots.txt', (_req, res) => {
  const base = env.PUBLIC_SITE_URL.replace(/\/$/, '');
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /super-admin',
      'Disallow: /api/',
      'Disallow: /bill/',
      '',
      `Sitemap: ${base}/sitemap.xml`,
    ].join('\n'),
  );
});

export default router;
