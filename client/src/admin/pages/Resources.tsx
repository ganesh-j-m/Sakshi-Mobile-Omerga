import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { DynamicIcon, ICONS } from '@/components/DynamicIcon';
import { DemoBadge, StockBadge } from '@/components/ui';
import { get, imageSrc } from '@/lib/api';
import { dateFmt } from '@/lib/format';
import type { Paginated, ProductSummary, StockStatus } from '@/types';
import { ResourcePage, type FieldDef } from '../ResourcePage';

type Row = { id: number; isActive?: boolean } & Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));

const Thumb = ({ url, fallback }: { url: unknown; fallback: string }) =>
  url ? (
    <img src={imageSrc(String(url), 120)} alt="" className="h-10 w-10 rounded-lg bg-slate-50 object-contain" />
  ) : (
    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-electric-500 to-violet-500 text-sm font-bold text-white">{fallback[0]}</span>
  );

export function BrandsPage() {
  return (
    <ResourcePage<Row>
      config={{
        title: 'Brand Management',
        subtitle: 'Brands shown in “Shop by Brand”, filters and brand pages',
        endpoint: 'brands',
        module: 'BRANDS',
        singular: 'Brand',
        columns: [
          { key: 'logo', label: '', render: (r) => <Thumb url={r.logoUrl} fallback={s(r.name)} /> },
          { key: 'name', label: 'Brand', render: (r) => <span className="font-semibold text-navy-900">{s(r.name)}</span> },
          { key: 'slug', label: 'URL', render: (r) => <code className="text-xs text-slate-500">/brands/{s(r.slug)}</code> },
          { key: 'featured', label: 'Featured', render: (r) => (r.isFeatured ? '★' : '—') },
          { key: 'order', label: 'Order', render: (r) => s(r.sortOrder) },
        ],
        fields: [
          { name: 'name', label: 'Brand name', type: 'text', required: true },
          { name: 'slug', label: 'URL slug', type: 'text', hint: 'Leave empty to generate from name' },
          { name: 'logoUrl', label: 'Logo', type: 'image', folder: 'brands' },
          { name: 'bannerUrl', label: 'Banner image', type: 'image', folder: 'brands' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'accentColor', label: 'Accent colour', type: 'color' },
          { name: 'sortOrder', label: 'Display order', type: 'number', default: 0, min: 0 },
          { name: 'isFeatured', label: 'Featured on homepage', type: 'checkbox', default: false },
          { name: 'isActive', label: 'Active', type: 'checkbox', default: true },
        ],
      }}
    />
  );
}

export function CategoriesPage() {
  return (
    <ResourcePage<Row>
      config={{
        title: 'Category Management',
        subtitle: 'Mobile & accessory categories',
        endpoint: 'categories',
        module: 'CATEGORIES',
        singular: 'Category',
        extraFilters: (set, v) => (
          <select className="input w-auto" value={v.type ?? ''} onChange={(e) => set('type', e.target.value)} aria-label="Type">
            <option value="">All types</option>
            <option value="MOBILE">Mobiles</option>
            <option value="ACCESSORY">Accessories</option>
          </select>
        ),
        columns: [
          { key: 'icon', label: '', render: (r) => <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><DynamicIcon name={s(r.icon)} className="h-4 w-4" /></span> },
          { key: 'name', label: 'Category', render: (r) => <span className="font-semibold text-navy-900">{s(r.name)}</span> },
          { key: 'type', label: 'Type', render: (r) => <span className="chip bg-slate-100 text-slate-600">{s(r.type)}</span> },
          { key: 'order', label: 'Order', render: (r) => s(r.sortOrder) },
        ],
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'slug', label: 'URL slug', type: 'text', hint: 'Leave empty to generate from name' },
          { name: 'type', label: 'Type', type: 'select', required: true, default: 'MOBILE', options: [{ value: 'MOBILE', label: 'Mobile' }, { value: 'ACCESSORY', label: 'Accessory' }] },
          { name: 'icon', label: 'Icon', type: 'select', options: Object.keys(ICONS).map((k) => ({ value: k, label: k })) },
          { name: 'imageUrl', label: 'Image', type: 'image', folder: 'misc' },
          { name: 'description', label: 'Description', type: 'textarea' },
          { name: 'sortOrder', label: 'Display order', type: 'number', default: 0, min: 0 },
          { name: 'isActive', label: 'Active', type: 'checkbox', default: true },
        ],
      }}
    />
  );
}

export function TestimonialsPage() {
  return (
    <ResourcePage<Row>
      config={{
        title: 'Customer Testimonials',
        subtitle: 'Only publish genuine reviews shared with the customer’s permission',
        endpoint: 'testimonials',
        module: 'TESTIMONIALS',
        singular: 'Testimonial',
        columns: [
          { key: 'name', label: 'Customer', render: (r) => <span className="font-semibold text-navy-900">{s(r.customerName)} {Boolean(r.isDemo) && <DemoBadge label="Demo" />}</span> },
          { key: 'rating', label: 'Rating', render: (r) => <span className="flex">{Array.from({ length: Number(r.rating) }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-flame-400 text-flame-400" />)}</span> },
          { key: 'msg', label: 'Review', render: (r) => <span className="line-clamp-2 max-w-md text-slate-600">{s(r.message)}</span> },
        ],
        fields: [
          { name: 'customerName', label: 'Customer name', type: 'text', required: true },
          { name: 'location', label: 'Location', type: 'text' },
          { name: 'rating', label: 'Rating (1–5)', type: 'number', required: true, default: 5, min: 1, max: 5 },
          { name: 'sortOrder', label: 'Display order', type: 'number', default: 0, min: 0 },
          { name: 'message', label: 'Review', type: 'textarea', required: true },
          { name: 'avatarUrl', label: 'Photo (optional)', type: 'image', folder: 'testimonials' },
          { name: 'isActive', label: 'Show on website', type: 'checkbox', default: true },
        ],
      }}
    />
  );
}

export function BannersPage() {
  const placements = [
    { value: 'HOME_HERO', label: 'Homepage spotlight slider' },
    { value: 'HOME_PROMO', label: 'Homepage promo blocks' },
    { value: 'OFFERS_PAGE', label: 'Offers page banner' },
  ];
  return (
    <ResourcePage<Row>
      config={{
        title: 'Homepage Banners',
        subtitle: 'Promotional banners with schedule & call-to-action',
        endpoint: 'banners',
        module: 'BANNERS',
        singular: 'Banner',
        extraFilters: (set, v) => (
          <select className="input w-auto" value={v.placement ?? ''} onChange={(e) => set('placement', e.target.value)} aria-label="Placement">
            <option value="">All placements</option>
            {placements.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        ),
        columns: [
          { key: 'img', label: '', render: (r) => <Thumb url={r.imageUrl} fallback={s(r.title)} /> },
          { key: 'title', label: 'Title', render: (r) => <span className="font-semibold text-navy-900">{s(r.title)} {Boolean(r.isDemo) && <DemoBadge label="Demo" />}</span> },
          { key: 'placement', label: 'Placement', render: (r) => placements.find((p) => p.value === r.placement)?.label },
          { key: 'sched', label: 'Schedule', render: (r) => <span className="text-xs text-slate-500">{r.startsAt || r.endsAt ? `${dateFmt(r.startsAt as string)} → ${dateFmt(r.endsAt as string)}` : 'Always'}</span> },
        ],
        fields: [
          { name: 'title', label: 'Title', type: 'text', required: true, full: true },
          { name: 'subtitle', label: 'Subtitle', type: 'textarea' },
          { name: 'placement', label: 'Placement', type: 'select', required: true, default: 'HOME_PROMO', options: placements },
          { name: 'theme', label: 'Colour theme', type: 'select', required: true, default: 'blue', options: ['blue', 'purple', 'orange', 'navy', 'pink', 'green'].map((t) => ({ value: t, label: t })) },
          { name: 'imageUrl', label: 'Desktop image (optional)', type: 'image', folder: 'banners' },
          { name: 'mobileImageUrl', label: 'Mobile image (optional)', type: 'image', folder: 'banners' },
          { name: 'ctaLabel', label: 'Button label', type: 'text' },
          { name: 'ctaLink', label: 'Button link', type: 'text', hint: 'e.g. /offers or https://…' },
          { name: 'startsAt', label: 'Show from', type: 'datetime' },
          { name: 'endsAt', label: 'Show until', type: 'datetime' },
          { name: 'sortOrder', label: 'Display order', type: 'number', default: 0, min: 0 },
          { name: 'isActive', label: 'Active', type: 'checkbox', default: true },
        ],
      }}
    />
  );
}

export function VariantsPage() {
  const products = useQuery({
    queryKey: ['admin', 'product-options-all'],
    queryFn: () => get<Paginated<ProductSummary>>('/admin/products', { limit: 100, sort: 'name' }),
  });
  const options = (products.data?.items ?? []).map((p) => ({ value: String(p.id), label: p.name }));
  const fields: FieldDef[] = [
    { name: 'productId', label: 'Product', type: 'select', required: true, options, full: true },
    { name: 'colorName', label: 'Colour name', type: 'text', required: true },
    { name: 'colorHex', label: 'Colour', type: 'color', required: true, default: '#1F2937' },
    { name: 'stockStatus', label: 'Stock', type: 'select', required: true, default: 'IN_STOCK', options: [
      { value: 'IN_STOCK', label: 'In stock' }, { value: 'LOW_STOCK', label: 'Low stock' }, { value: 'OUT_OF_STOCK', label: 'Out of stock' }, { value: 'PRE_ORDER', label: 'Pre-order' },
    ] },
    { name: 'sortOrder', label: 'Order', type: 'number', default: 0, min: 0 },
    { name: 'imageUrl', label: 'Variant image', type: 'image', folder: 'products' },
  ];
  return (
    <ResourcePage<Row>
      config={{
        title: 'Product Variants',
        subtitle: 'Colour variants for every product (also editable inside the product form)',
        endpoint: 'variants',
        module: 'PRODUCTS',
        singular: 'Variant',
        hasStatus: false,
        extraFilters: (set, v) => (
          <select className="input w-auto max-w-xs" value={v.productId ?? ''} onChange={(e) => set('productId', e.target.value)} aria-label="Product">
            <option value="">All products</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ),
        columns: [
          { key: 'swatch', label: '', render: (r) => <span className="block h-8 w-8 rounded-full ring-1 ring-black/10" style={{ background: s(r.colorHex) }} /> },
          { key: 'name', label: 'Colour', render: (r) => <span className="font-semibold text-navy-900">{s(r.colorName)}</span> },
          { key: 'product', label: 'Product', render: (r) => options.find((o) => o.value === String(r.productId))?.label ?? `#${s(r.productId)}` },
          { key: 'stock', label: 'Stock', render: (r) => <StockBadge status={r.stockStatus as StockStatus} /> },
        ],
        fields: fields.map((f) => (f.name === 'productId' ? { ...f, options } : f)),
      }}
    />
  );
}
