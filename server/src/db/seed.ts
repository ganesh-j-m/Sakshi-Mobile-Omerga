/**
 * Seed script — creates the first Super Admin, default settings, CMS blocks and
 * CLEARLY-LABELLED DEMO catalogue data (every demo row has is_demo = true and the
 * word "Demo" in its name). Real prices, phone numbers, addresses and offers must be
 * entered by the business owner through the admin panel.
 *
 * Safe to run more than once (uses ON CONFLICT DO NOTHING).
 */
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from './index.js';
import {
  adminProfiles,
  banners,
  branchBrands,
  branches,
  branchOffers,
  branchProducts,
  brands,
  categories,
  cmsPages,
  offers,
  productImages,
  products,
  productVariants,
  systemSettings,
  testimonials,
  users,
} from './schema.js';
import { hashPassword } from '../lib/password.js';
import { DEFAULT_GENERAL } from '../lib/settings.js';
import { slugify } from '../lib/slug.js';

const SEED_DEMO = (process.env.SEED_DEMO_DATA ?? 'true') !== 'false';

async function seedSuperAdmin() {
  const loginId = process.env.SEED_SUPER_ADMIN_LOGIN ?? 'superadmin';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error('Set SEED_SUPER_ADMIN_PASSWORD (min 10 chars) in .env before seeding');
  }
  const existing = await db.query.users.findFirst({ where: eq(users.loginId, loginId) });
  if (existing) return console.log(`• Super Admin "${loginId}" already exists — skipped`);
  const [u] = await db
    .insert(users)
    .values({ loginId, passwordHash: await hashPassword(password), role: 'SUPER_ADMIN' })
    .returning({ id: users.id });
  await db.insert(adminProfiles).values({
    userId: u.id,
    fullName: process.env.SEED_SUPER_ADMIN_NAME ?? 'Super Admin',
    designation: 'Owner / Super Admin',
  });
  console.log(`✔ Super Admin created → Login ID: ${loginId}  (change the password after first login)`);
}

async function seedSettings() {
  await db
    .insert(systemSettings)
    .values([
      { key: 'general', value: DEFAULT_GENERAL },
      {
        key: 'seo',
        value: {
          '/': {
            title: 'Sakshi Mobile Omerga — Smartphones, Accessories & Best Offers',
            description:
              'Explore the latest smartphones from Apple, Samsung, Vivo, Oppo, Redmi, Realme, Motorola and OnePlus with accessories and offers at Sakshi Mobile, Omerga.',
          },
          '/mobiles': { title: 'All Mobiles', description: 'Browse smartphones by brand, price, RAM and storage at Sakshi Mobile.' },
          '/accessories': { title: 'Mobile Accessories', description: 'Chargers, earbuds, covers, screen guards, power banks and more.' },
          '/offers': { title: 'Latest Offers', description: 'Current mobile offers, exchange and EMI options at Sakshi Mobile.' },
          '/branches': { title: 'Our Branches', description: 'Find a Sakshi Mobile store near you — address, timings and directions.' },
        },
      },
    ])
    .onConflictDoNothing();
  console.log('✔ System settings');
}

const SAMPLE_NOTICE = 'Template text — please review and replace with your verified business policy.';

async function seedCms() {
  const blocks: { key: string; title: string; content: Record<string, unknown> }[] = [
    {
      key: 'announcement',
      title: 'Announcement Bar',
      content: {
        enabled: true,
        items: [
          { text: '📱 New smartphones arriving regularly — visit our Omerga store', link: '/mobiles' },
          { text: '🔁 Exchange & EMI inquiries welcome — ask on WhatsApp', link: '/offers' },
          { text: '🏬 Sakshi Mobile — now online. Explore our branches', link: '/branches' },
        ],
      },
    },
    {
      key: 'home_hero',
      title: 'Homepage Hero',
      content: {
        eyebrow: 'Omerga’s smartphone destination',
        headline: 'Your next smartphone,',
        highlight: 'one tap away.',
        subheadline:
          'Latest phones from top brands, genuine accessories and helpful in-store guidance — explore online, then visit Sakshi Mobile or chat with us on WhatsApp.',
        primaryCtaLabel: 'Explore Mobiles',
        primaryCtaLink: '/mobiles',
        secondaryCtaLabel: 'WhatsApp Inquiry',
        badges: [
          { label: 'Top brands' },
          { label: 'Exchange inquiries' },
          { label: 'EMI inquiries' },
        ],
      },
    },
    {
      key: 'why_choose',
      title: 'Why Choose Sakshi Mobile',
      content: {
        title: 'Why choose Sakshi Mobile?',
        subtitle: 'Shopping for a phone should feel easy. Here’s how we help.',
        items: [
          { icon: 'BadgeCheck', title: 'Genuine products', text: 'Brand-new devices and accessories with manufacturer warranty.' },
          { icon: 'Layers', title: 'All top brands', text: 'Compare Apple, Samsung, Vivo, Oppo, Redmi, Realme, Motorola & OnePlus in one place.' },
          { icon: 'RefreshCw', title: 'Exchange support', text: 'Ask us about exchanging your old phone when you upgrade.' },
          { icon: 'CreditCard', title: 'EMI inquiries', text: 'Ask our team about available EMI and finance options.' },
          { icon: 'Headphones', title: 'Friendly guidance', text: 'Honest advice to pick the right phone for your budget.' },
          { icon: 'MapPin', title: 'Local store', text: 'Visit us in Omerga for hands-on demos and after-sales help.' },
        ],
      },
    },
    {
      key: 'about',
      title: 'About Us',
      content: {
        title: 'About Sakshi Mobile',
        intro:
          'Sakshi Mobile is a mobile phone and accessories store based in Omerga, Maharashtra. [Replace this text with the verified story of the business.]',
        story:
          'Add the history of the shop here — when it started, who runs it, and what makes the store special for customers in Omerga and nearby villages.',
        mission: 'Help every customer choose the right smartphone with honest guidance and genuine products.',
        vision: 'To be the most trusted mobile retail brand in the region.',
        values: [
          { title: 'Trust', text: 'Genuine products and transparent information.' },
          { title: 'Service', text: 'Support before and after the purchase.' },
          { title: 'Choice', text: 'All major brands under one roof.' },
        ],
      },
    },
    {
      key: 'contact',
      title: 'Contact Information',
      content: {
        heading: 'We’d love to help you',
        phone: '',
        whatsapp: '',
        email: '',
        address: 'Omerga, Dharashiv district, Maharashtra',
        hours: 'Update opening hours from the admin panel',
        note: 'Contact details will appear here once verified by the business owner.',
      },
    },
    {
      key: 'footer',
      title: 'Footer',
      content: {
        about: 'Sakshi Mobile — smartphones, accessories and friendly service in Omerga, Maharashtra.',
        copyright: 'Sakshi Mobile. All rights reserved.',
        developedBy: 'MoreTech Solution',
        developedByUrl: '',
      },
    },
    { key: 'social', title: 'Social Media Links', content: { facebook: '', instagram: '', youtube: '', x: '' } },
    {
      key: 'privacy',
      title: 'Privacy Policy',
      content: {
        notice: SAMPLE_NOTICE,
        sections: [
          { heading: 'Information we collect', body: 'When you submit an inquiry we collect your name, mobile number, optional email address and the details of your inquiry.' },
          { heading: 'How we use it', body: 'We use this information only to respond to your inquiry about products, offers, exchange or EMI options, and to improve our service.' },
          { heading: 'Sharing', body: 'We do not sell your personal information. Details may be shared only with service providers who help us operate this website, or when required by law.' },
          { heading: 'WhatsApp', body: 'If you contact us on WhatsApp, your conversation is also subject to WhatsApp’s own privacy policy.' },
          { heading: 'Data retention & your rights', body: 'You can ask us to update or delete your inquiry details by contacting the store.' },
          { heading: 'Contact', body: 'For privacy questions, please contact Sakshi Mobile using the details on the Contact page.' },
        ],
      },
    },
    {
      key: 'terms',
      title: 'Terms and Conditions',
      content: {
        notice: SAMPLE_NOTICE,
        sections: [
          { heading: 'Product information', body: 'We try to keep prices, specifications and availability accurate, but they may change without notice. Please confirm details with the store before purchase.' },
          { heading: 'Prices & offers', body: 'Offers are valid for the period shown and may be subject to stock availability and additional terms set by brands or finance partners.' },
          { heading: 'Inquiries', body: 'Submitting an inquiry does not create an order or reservation. Our team will contact you to confirm details.' },
          { heading: 'Warranty', body: 'Products carry the manufacturer’s warranty as stated by the brand. Warranty service is provided by authorised service centres.' },
          { heading: 'Exchange & EMI', body: 'Exchange values and EMI eligibility are decided after inspection and verification, and are subject to partner terms.' },
          { heading: 'Governing law', body: 'These terms are governed by the laws of India.' },
        ],
      },
    },
  ];
  await db.insert(cmsPages).values(blocks).onConflictDoNothing();
  console.log('✔ CMS content blocks');
}

/* ─────────────────────────────── Demo data ─────────────────────────────── */

const BRANDS = [
  { name: 'Apple', accentColor: '#111827' },
  { name: 'Samsung', accentColor: '#1428A0' },
  { name: 'Vivo', accentColor: '#415FFF' },
  { name: 'Oppo', accentColor: '#1BA784' },
  { name: 'Redmi', accentColor: '#FF6900' },
  { name: 'Realme', accentColor: '#F5C400' },
  { name: 'Motorola', accentColor: '#5C6BC0' },
  { name: 'OnePlus', accentColor: '#EB0028' },
];

const CATEGORIES = [
  { name: 'Smartphones', type: 'MOBILE' as const, icon: 'Smartphone' },
  { name: '5G Phones', type: 'MOBILE' as const, icon: 'Signal' },
  { name: 'Feature Phones', type: 'MOBILE' as const, icon: 'Phone' },
  { name: 'Chargers & Cables', type: 'ACCESSORY' as const, icon: 'PlugZap' },
  { name: 'Earbuds & Headphones', type: 'ACCESSORY' as const, icon: 'Headphones' },
  { name: 'Cases & Covers', type: 'ACCESSORY' as const, icon: 'Shield' },
  { name: 'Screen Guards', type: 'ACCESSORY' as const, icon: 'ScanLine' },
  { name: 'Power Banks', type: 'ACCESSORY' as const, icon: 'BatteryCharging' },
  { name: 'Smart Watches', type: 'ACCESSORY' as const, icon: 'Watch' },
];

const COLORS: Record<string, { name: string; hex: string }[]> = {
  a: [{ name: 'Midnight Black', hex: '#1F2937' }, { name: 'Ocean Blue', hex: '#2563EB' }, { name: 'Lavender', hex: '#A78BFA' }],
  b: [{ name: 'Graphite', hex: '#374151' }, { name: 'Sunset Orange', hex: '#F97316' }],
  c: [{ name: 'Starlight', hex: '#E5E7EB' }, { name: 'Emerald', hex: '#10B981' }, { name: 'Space Black', hex: '#111827' }],
  d: [{ name: 'Black', hex: '#111111' }, { name: 'White', hex: '#F9FAFB' }],
};

type DemoPhone = {
  brand: string;
  name: string;
  cat: string;
  mrp: number;
  sp: number;
  op?: number;
  ram?: number;
  storage?: number;
  colors: keyof typeof COLORS;
  featured?: boolean;
  stock?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER';
  display?: string;
  camera?: string;
  battery?: string;
  processor?: string;
};

const MOBILES: DemoPhone[] = [
  { brand: 'Apple', name: 'iPhone Demo 128 GB', cat: '5G Phones', mrp: 79900, sp: 74900, op: 71900, ram: 6, storage: 128, colors: 'c', featured: true, display: '6.1" Super Retina OLED', camera: '48MP + 12MP | 12MP front', battery: 'All-day battery', processor: 'Apple A-series chip (demo spec)' },
  { brand: 'Apple', name: 'iPhone Demo Plus 256 GB', cat: '5G Phones', mrp: 99900, sp: 94900, ram: 8, storage: 256, colors: 'c', display: '6.7" Super Retina OLED', camera: '48MP + 12MP | 12MP front', battery: 'All-day battery', processor: 'Apple A-series chip (demo spec)', stock: 'LOW_STOCK' },
  { brand: 'Samsung', name: 'Galaxy A-Demo 5G', cat: '5G Phones', mrp: 32999, sp: 29999, op: 27999, ram: 8, storage: 128, colors: 'a', featured: true, display: '6.6" FHD+ Super AMOLED, 120Hz', camera: '50MP + 12MP + 5MP | 32MP front', battery: '5000 mAh, 25W fast charging', processor: 'Octa-core 5G processor (demo spec)' },
  { brand: 'Samsung', name: 'Galaxy M-Demo', cat: 'Smartphones', mrp: 16999, sp: 14499, ram: 6, storage: 128, colors: 'b', display: '6.7" FHD+ sAMOLED, 90Hz', camera: '50MP + 8MP + 2MP | 13MP front', battery: '6000 mAh', processor: 'Octa-core processor (demo spec)' },
  { brand: 'Samsung', name: 'Galaxy S-Demo Ultra', cat: '5G Phones', mrp: 129999, sp: 124999, op: 119999, ram: 12, storage: 256, colors: 'd', featured: true, display: '6.8" QHD+ Dynamic AMOLED, 120Hz', camera: '200MP quad camera | 12MP front', battery: '5000 mAh, 45W', processor: 'Flagship octa-core (demo spec)', stock: 'PRE_ORDER' },
  { brand: 'Vivo', name: 'Vivo V-Demo Pro', cat: '5G Phones', mrp: 39999, sp: 36999, op: 34999, ram: 8, storage: 256, colors: 'a', featured: true, display: '6.78" 3D curved AMOLED, 120Hz', camera: '50MP + 50MP | 50MP front', battery: '5000 mAh, 80W', processor: 'Octa-core 5G processor (demo spec)' },
  { brand: 'Vivo', name: 'Vivo Y-Demo', cat: 'Smartphones', mrp: 13999, sp: 11999, ram: 4, storage: 128, colors: 'b', display: '6.56" HD+ LCD, 90Hz', camera: '50MP + 2MP | 8MP front', battery: '5000 mAh, 15W', processor: 'Octa-core processor (demo spec)' },
  { brand: 'Oppo', name: 'Oppo Reno-Demo 5G', cat: '5G Phones', mrp: 34999, sp: 32999, ram: 8, storage: 256, colors: 'a', featured: true, display: '6.7" FHD+ AMOLED, 120Hz', camera: '50MP + 8MP + 32MP tele | 32MP front', battery: '5000 mAh, 67W SUPERVOOC', processor: 'Octa-core 5G processor (demo spec)' },
  { brand: 'Oppo', name: 'Oppo A-Demo', cat: 'Smartphones', mrp: 15999, sp: 13999, op: 12999, ram: 6, storage: 128, colors: 'b', display: '6.67" HD+ LCD, 90Hz', camera: '50MP + 2MP | 8MP front', battery: '5100 mAh, 33W', processor: 'Octa-core processor (demo spec)' },
  { brand: 'Redmi', name: 'Redmi Note Demo 5G', cat: '5G Phones', mrp: 21999, sp: 18999, op: 17499, ram: 8, storage: 128, colors: 'a', featured: true, display: '6.67" FHD+ AMOLED, 120Hz', camera: '108MP + 8MP + 2MP | 16MP front', battery: '5000 mAh, 33W', processor: 'Octa-core 5G processor (demo spec)' },
  { brand: 'Redmi', name: 'Redmi Demo A', cat: 'Smartphones', mrp: 8999, sp: 7499, ram: 4, storage: 64, colors: 'b', display: '6.71" HD+ LCD', camera: '8MP | 5MP front', battery: '5000 mAh', processor: 'Octa-core processor (demo spec)' },
  { brand: 'Realme', name: 'Realme Demo Pro 5G', cat: '5G Phones', mrp: 26999, sp: 24999, op: 23499, ram: 8, storage: 256, colors: 'a', display: '6.7" FHD+ curved AMOLED, 120Hz', camera: '50MP OIS + 8MP | 16MP front', battery: '5000 mAh, 67W', processor: 'Octa-core 5G processor (demo spec)' },
  { brand: 'Realme', name: 'Realme Narzo-Demo', cat: 'Smartphones', mrp: 12999, sp: 10999, ram: 4, storage: 128, colors: 'b', display: '6.72" FHD+ LCD, 120Hz', camera: '50MP + 2MP | 8MP front', battery: '5000 mAh, 33W', processor: 'Octa-core processor (demo spec)', stock: 'OUT_OF_STOCK' },
  { brand: 'Motorola', name: 'Moto G-Demo 5G', cat: '5G Phones', mrp: 19999, sp: 17999, ram: 8, storage: 128, colors: 'a', display: '6.55" pOLED, 120Hz', camera: '50MP + 13MP | 32MP front', battery: '5000 mAh, 30W', processor: 'Octa-core 5G processor (demo spec)' },
  { brand: 'Motorola', name: 'Moto Edge-Demo', cat: '5G Phones', mrp: 29999, sp: 27999, op: 25999, ram: 12, storage: 256, colors: 'd', featured: true, display: '6.7" curved pOLED, 144Hz', camera: '50MP + 13MP + 10MP tele | 32MP front', battery: '4500 mAh, 68W', processor: 'Octa-core 5G processor (demo spec)' },
  { brand: 'OnePlus', name: 'OnePlus Demo 5G', cat: '5G Phones', mrp: 64999, sp: 59999, op: 56999, ram: 12, storage: 256, colors: 'd', featured: true, display: '6.82" QHD+ AMOLED, 120Hz', camera: '50MP triple camera | 32MP front', battery: '5400 mAh, 100W', processor: 'Flagship octa-core (demo spec)' },
  { brand: 'OnePlus', name: 'OnePlus Nord-Demo', cat: '5G Phones', mrp: 29999, sp: 27999, ram: 8, storage: 128, colors: 'a', display: '6.74" FHD+ AMOLED, 120Hz', camera: '50MP + 8MP | 16MP front', battery: '5500 mAh, 80W', processor: 'Octa-core 5G processor (demo spec)' },
  { brand: 'Samsung', name: 'Guru-Demo Keypad Phone', cat: 'Feature Phones', mrp: 1999, sp: 1799, colors: 'd', display: '2.4" QVGA', camera: 'VGA camera', battery: '1500 mAh', processor: 'Feature-phone chipset (demo spec)' },
];

const ACCESSORIES: { brand: string; name: string; cat: string; mrp: number; sp: number; op?: number; featured?: boolean }[] = [
  { brand: 'Samsung', name: '25W Fast Charger — Demo', cat: 'Chargers & Cables', mrp: 1499, sp: 1199, featured: true },
  { brand: 'OnePlus', name: 'Type-C to Type-C Cable — Demo', cat: 'Chargers & Cables', mrp: 799, sp: 599 },
  { brand: 'Realme', name: 'Wireless Earbuds Demo Air', cat: 'Earbuds & Headphones', mrp: 2999, sp: 1999, op: 1799, featured: true },
  { brand: 'OnePlus', name: 'Neckband Demo Z', cat: 'Earbuds & Headphones', mrp: 2299, sp: 1699 },
  { brand: 'Apple', name: 'Clear Case Demo (iPhone)', cat: 'Cases & Covers', mrp: 999, sp: 699, featured: true },
  { brand: 'Samsung', name: 'Tempered Glass Demo', cat: 'Screen Guards', mrp: 499, sp: 299 },
  { brand: 'Redmi', name: '20000 mAh Power Bank — Demo', cat: 'Power Banks', mrp: 2499, sp: 1799, op: 1599, featured: true },
  { brand: 'Realme', name: 'Smart Watch Demo Fit', cat: 'Smart Watches', mrp: 4999, sp: 3499, featured: true },
];

async function seedDemo() {
  await db
    .insert(brands)
    .values(
      BRANDS.map((b, i) => ({
        ...b,
        slug: slugify(b.name),
        isFeatured: true,
        sortOrder: i,
        description: `${b.name} smartphones and accessories at Sakshi Mobile. (Brand description — editable in admin.)`,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(categories)
    .values(CATEGORIES.map((c, i) => ({ ...c, slug: slugify(c.name), sortOrder: i })))
    .onConflictDoNothing();

  const brandMap = new Map((await db.select().from(brands)).map((b) => [b.name, b.id]));
  const catMap = new Map((await db.select().from(categories)).map((c) => [c.name, c.id]));

  // The Omerga branch is real, but contact details are left blank until verified by the owner.
  await db
    .insert(branches)
    .values({
      code: 'OMG-01',
      slug: 'omerga',
      name: 'Sakshi Mobile — Omerga',
      type: 'MAIN',
      intro:
        'Our main store in Omerga. Visit us to explore the latest smartphones and accessories. (Branch details are pending verification — update address, phone and timings from the admin panel.)',
      addressLine: 'Address to be updated by the store owner',
      city: 'Omerga',
      district: 'Dharashiv',
      state: 'Maharashtra',
      openingHours: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => ({
        day,
        open: '',
        close: '',
        closed: false,
      })),
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Sakshi+Mobile+Omerga',
      services: ['New smartphones', 'Mobile accessories', 'Exchange inquiries', 'EMI inquiries'],
      isDemo: true,
      sortOrder: 0,
    })
    .onConflictDoNothing();
  const [omerga] = await db.select().from(branches).where(eq(branches.slug, 'omerga'));

  await db
    .insert(branchBrands)
    .values([...brandMap.values()].map((brandId) => ({ branchId: omerga.id, brandId })))
    .onConflictDoNothing();

  const all = [
    ...MOBILES.map((m) => ({ ...m, kind: 'm' as const })),
    ...ACCESSORIES.map((a) => ({ ...a, kind: 'a' as const, colors: 'd' as const })),
  ];

  for (const [i, p] of all.entries()) {
    const slug = slugify(`${p.brand} ${p.name}`.replace(new RegExp(`^${p.brand} ${p.brand}`, 'i'), p.brand));
    const sku = `DEMO-${String(i + 1).padStart(3, '0')}`;
    const m = p.kind === 'm' ? (p as DemoPhone) : null;
    const [row] = await db
      .insert(products)
      .values({
        sku,
        name: p.name.startsWith(p.brand) ? p.name : `${p.brand} ${p.name}`,
        slug,
        brandId: brandMap.get(p.brand)!,
        categoryId: catMap.get(p.cat)!,
        model: sku,
        mrp: p.mrp,
        sellingPrice: p.sp,
        offerPrice: p.op ?? null,
        ramGb: m?.ram ?? null,
        storageGb: m?.storage ?? null,
        display: m?.display ?? null,
        camera: m?.camera ?? null,
        battery: m?.battery ?? null,
        processor: m?.processor ?? null,
        description:
          'DEMO PRODUCT — this listing, its price and specifications are sample data to preview the website. Replace with verified product information from the admin panel.',
        highlights: m
          ? [m.display, m.camera, m.battery].filter((x): x is string => Boolean(x))
          : ['Sample accessory listing', 'Replace with real product details'],
        warranty: '1 year manufacturer warranty (verify per product)',
        stockStatus: m?.stock ?? 'IN_STOCK',
        isFeatured: Boolean(p.featured),
        isDemo: true,
      })
      .onConflictDoNothing()
      .returning({ id: products.id });
    if (!row) continue;
    const colors = COLORS[p.colors];
    await db.insert(productVariants).values(colors.map((c, idx) => ({ productId: row.id, colorName: c.name, colorHex: c.hex, sortOrder: idx })));
    await db
      .insert(branchProducts)
      .values({ branchId: omerga.id, productId: row.id, stockStatus: m?.stock === 'OUT_OF_STOCK' ? 'OUT_OF_STOCK' : 'IN_STOCK' })
      .onConflictDoNothing();
  }
  void productImages; // demo products intentionally have no photos → the UI renders a branded illustration

  const in30 = new Date(Date.now() + 30 * 864e5);
  const offerRows = await db
    .insert(offers)
    .values([
      {
        title: 'Demo Offer — Exchange Your Old Phone',
        slug: 'demo-exchange-offer',
        description: 'DEMO OFFER: Sample exchange offer to preview the Offers section. Replace with a real, verified offer.',
        offerType: 'EXCHANGE',
        discountType: 'NONE',
        badge: 'Exchange',
        validTo: in30,
        isFeatured: true,
        isDemo: true,
        terms: 'Demo terms. Exchange value depends on device condition.',
      },
      {
        title: 'Demo Offer — Easy EMI Inquiry',
        slug: 'demo-emi-offer',
        description: 'DEMO OFFER: Ask about EMI options on selected smartphones. Replace with real finance partner details.',
        offerType: 'EMI',
        discountType: 'NONE',
        badge: 'EMI',
        validTo: in30,
        isFeatured: true,
        isDemo: true,
      },
      {
        title: 'Demo Offer — Accessories Combo',
        slug: 'demo-accessories-combo',
        description: 'DEMO OFFER: Sample combo discount on accessories with a new phone.',
        offerType: 'BUNDLE',
        discountType: 'PERCENT',
        discountValue: 10,
        badge: '10% off',
        validTo: in30,
        isDemo: true,
      },
    ])
    .onConflictDoNothing()
    .returning({ id: offers.id });
  if (offerRows.length) {
    await db.insert(branchOffers).values(offerRows.map((o) => ({ branchId: omerga.id, offerId: o.id }))).onConflictDoNothing();
  }

  const tCount = await db.select({ c: sql<number>`count(*)::int` }).from(testimonials);
  if (!tCount[0].c) {
    await db.insert(testimonials).values([
      { customerName: 'Demo Customer A', location: 'Omerga', rating: 5, message: 'Sample review — replace with genuine customer feedback collected with permission.', isDemo: true, sortOrder: 0 },
      { customerName: 'Demo Customer B', location: 'Omerga', rating: 5, message: 'Sample review text to preview the testimonials slider.', isDemo: true, sortOrder: 1 },
      { customerName: 'Demo Customer C', location: 'Dharashiv', rating: 4, message: 'Sample review — admins can add, edit or hide reviews in the CMS.', isDemo: true, sortOrder: 2 },
    ]);
  }

  const bCount = await db.select({ c: sql<number>`count(*)::int` }).from(banners);
  if (!bCount[0].c) {
    await db.insert(banners).values([
      { title: 'Demo Banner — New arrivals in store', subtitle: 'Promotional banner preview. Edit in Website CMS → Banners.', ctaLabel: 'Shop mobiles', ctaLink: '/mobiles', placement: 'HOME_PROMO', theme: 'purple', isDemo: true, sortOrder: 0 },
      { title: 'Demo Banner — Accessories for every phone', subtitle: 'Chargers, earbuds, covers & more.', ctaLabel: 'View accessories', ctaLink: '/accessories', placement: 'HOME_PROMO', theme: 'orange', isDemo: true, sortOrder: 1 },
      { title: 'Demo Banner — Ask about exchange & EMI', subtitle: 'Offers page banner preview.', ctaLabel: 'WhatsApp us', ctaLink: '/contact', placement: 'OFFERS_PAGE', theme: 'blue', isDemo: true, sortOrder: 0 },
    ]);
  }
  console.log('✔ Demo catalogue (brands, categories, Omerga branch, products, offers, reviews, banners)');
}

async function main() {
  await seedSuperAdmin();
  await seedSettings();
  await seedCms();
  if (SEED_DEMO) await seedDemo();
  console.log('🌱 Seed complete');
  await pool.end();
}

main().catch(async (err) => {
  console.error('❌ Seed failed:', err.message ?? err);
  await pool.end();
  process.exit(1);
});
