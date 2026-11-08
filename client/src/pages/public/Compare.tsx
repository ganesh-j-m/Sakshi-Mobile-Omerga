import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { ProductMedia } from '@/components/ProductMedia';
import { Seo } from '@/components/Seo';
import { Button, EmptyState, LinkButton, PageLoader, StockBadge } from '@/components/ui';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { useCompare } from '@/context/compare';
import { get } from '@/lib/api';
import { cn } from '@/lib/cn';
import { effectivePrice, gb, inr } from '@/lib/format';
import type { Paginated, ProductDetail, ProductSummary } from '@/types';

type CompareProduct = Omit<ProductDetail, 'availability'>;

function AddProduct() {
  const { toggle, items, max } = useCompare();
  const [term, setTerm] = useState('');
  const { data } = useQuery({
    queryKey: ['compare-search', term],
    queryFn: () => get<Paginated<ProductSummary>>('/public/products', { search: term, type: 'MOBILE', limit: 6 }),
    enabled: term.trim().length >= 2,
  });
  if (items.length >= max) return null;
  return (
    <div className="relative">
      <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search a phone to add…" className="input" aria-label="Search a phone to add" />
      {data && term.length >= 2 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {data.items.filter((p) => !items.some((i) => i.slug === p.slug)).map((p) => (
            <li key={p.id}>
              <button
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  toggle({ slug: p.slug, name: p.name });
                  setTerm('');
                }}
              >
                <span className="truncate">{p.name}</span>
                <Plus className="h-4 w-4 text-electric-600" />
              </button>
            </li>
          ))}
          {data.items.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No phones found</li>}
        </ul>
      )}
    </div>
  );
}

export default function Compare() {
  const { items, remove, clear } = useCompare();
  const slugs = items.map((i) => i.slug);
  const { data, isLoading } = useQuery({
    queryKey: ['compare', slugs.join(',')],
    queryFn: () => get<{ items: CompareProduct[] }>('/public/products/compare', { slugs }),
    enabled: slugs.length > 0,
  });
  const list = data?.items ?? [];

  const best = (vals: (number | null)[], mode: 'min' | 'max') => {
    const nums = vals.filter((v): v is number => v != null);
    if (nums.length < 2) return null;
    return mode === 'min' ? Math.min(...nums) : Math.max(...nums);
  };
  const prices = list.map((p) => effectivePrice(p));
  const bestPrice = best(prices, 'min');
  const bestRam = best(list.map((p) => p.ramGb), 'max');
  const bestStorage = best(list.map((p) => p.storageGb), 'max');

  const rows: { label: string; render: (p: CompareProduct, i: number) => React.ReactNode; win?: (p: CompareProduct, i: number) => boolean }[] = [
    { label: 'Price', render: (p) => <span className="text-lg font-bold">{inr(effectivePrice(p))}</span>, win: (_p, i) => prices[i] === bestPrice },
    { label: 'MRP', render: (p) => inr(p.mrp) },
    { label: 'Brand', render: (p) => p.brand.name },
    { label: 'RAM', render: (p) => gb(p.ramGb) ?? '—', win: (p) => p.ramGb != null && p.ramGb === bestRam },
    { label: 'Storage', render: (p) => gb(p.storageGb) ?? '—', win: (p) => p.storageGb != null && p.storageGb === bestStorage },
    { label: 'Display', render: (p) => p.display ?? '—' },
    { label: 'Camera', render: (p) => p.camera ?? '—' },
    { label: 'Battery', render: (p) => p.battery ?? '—' },
    { label: 'Processor', render: (p) => p.processor ?? '—' },
    { label: 'Colours', render: (p) => (
      <div className="flex flex-wrap gap-1.5">{p.variants.map((v) => <span key={v.id} title={v.colorName} className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: v.colorHex }} />)}</div>
    ) },
    { label: 'Warranty', render: (p) => p.warranty ?? '—' },
    { label: 'Availability', render: (p) => <StockBadge status={p.stockStatus} /> },
  ];

  return (
    <>
      <Seo title="Compare Mobiles" description="Compare smartphones side by side — price, RAM, storage, camera, battery and more." />
      <PageHeader eyebrow="Compare" title={<>Compare <span className="text-gradient">mobiles</span></>} text="Put up to 4 phones side by side to find the right one." crumbs={[{ label: 'Compare' }]} />
      <section className="container py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="w-full max-w-sm"><AddProduct /></div>
          {items.length > 0 && <Button variant="ghost" size="sm" onClick={clear}><X className="h-4 w-4" /> Clear all</Button>}
        </div>
        {!items.length ? (
          <EmptyState title="No products to compare yet" text="Tap the compare icon on any product card, or search above to add phones." action={<LinkButton to="/mobiles">Browse mobiles</LinkButton>} />
        ) : isLoading ? (
          <PageLoader />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-card">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-36 bg-white p-4" />
                  {list.map((p) => (
                    <th key={p.id} className="min-w-[200px] border-l border-slate-100 p-4 align-top">
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative flex flex-col items-center gap-3 text-center">
                        <button onClick={() => remove(p.slug)} className="absolute right-0 top-0 rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500" aria-label={`Remove ${p.name}`}>
                          <X className="h-4 w-4" />
                        </button>
                        <div className="flex h-36 items-center justify-center">
                          <ProductMedia url={p.images[0]?.url} alt={p.name} type={p.category.type} color={p.variants[0]?.colorHex} />
                        </div>
                        <Link to={`/mobiles/${p.slug}`} className="font-semibold text-navy-900 hover:text-electric-600">{p.name}</Link>
                      </motion.div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={r.label} className={cn(ri % 2 === 0 && 'bg-slate-50/60')}>
                    <th scope="row" className="sticky left-0 z-10 bg-inherit p-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{r.label}</th>
                    {list.map((p, i) => {
                      const win = r.win?.(p, i);
                      return (
                        <td key={p.id} className={cn('border-l border-slate-100 p-4 text-center text-navy-900', win && 'bg-emerald-50/80')}>
                          <div className="flex items-center justify-center gap-1.5">
                            {win && <Trophy className="h-4 w-4 text-emerald-500" />}
                            {r.render(p, i)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="sticky left-0 bg-white p-4" />
                  {list.map((p) => (
                    <td key={p.id} className="border-l border-slate-100 p-4">
                      <WhatsAppButton size="sm" className="w-full" context={{ kind: 'product', product: p }}>Enquire</WhatsAppButton>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
