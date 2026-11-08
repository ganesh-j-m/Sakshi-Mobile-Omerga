import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { Seo } from '@/components/Seo';
import { Button, EmptyState, ErrorState, Pagination } from '@/components/ui';
import { get } from '@/lib/api';
import { cn } from '@/lib/cn';
import { gb, inr, STOCK_META } from '@/lib/format';
import type { Branch, Facets, Paginated, ProductSummary, StockStatus } from '@/types';

const SORTS = [
  { v: 'latest', l: 'Latest' },
  { v: 'featured', l: 'Featured' },
  { v: 'price_asc', l: 'Price: Low to High' },
  { v: 'price_desc', l: 'Price: High to Low' },
  { v: 'name', l: 'Name A–Z' },
];

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 pb-5">
      <h3 className="mb-3 text-sm font-semibold text-navy-900">{title}</h3>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
        active ? 'bg-gradient-to-r from-electric-500 to-violet-500 text-white shadow-glow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
      )}
    >
      {children}
    </button>
  );
}

export default function Catalog({ type }: { type: 'MOBILE' | 'ACCESSORY' }) {
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const [searchText, setSearchText] = useState(params.get('search') ?? '');
  const isMobile = type === 'MOBILE';

  const filters = {
    search: params.get('search') ?? '',
    brand: list(params.get('brand')),
    category: list(params.get('category')),
    ram: list(params.get('ram')),
    storage: list(params.get('storage')),
    availability: list(params.get('availability')),
    branch: params.get('branch') ?? '',
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    sort: params.get('sort') ?? 'latest',
    page: Number(params.get('page') ?? 1),
  };

  const update = (patch: Record<string, string | string[] | number | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      const val = Array.isArray(v) ? v.join(',') : v === undefined ? '' : String(v);
      if (val) next.set(k, val);
      else next.delete(k);
    }
    if (resetPage && !('page' in patch)) next.delete('page');
    setParams(next, { replace: false });
  };
  const toggle = (key: 'brand' | 'category' | 'ram' | 'storage' | 'availability', value: string) => {
    const cur = filters[key];
    update({ [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
  };

  useEffect(() => setSearchText(filters.search), [filters.search]);

  const facets = useQuery({ queryKey: ['facets', type], queryFn: () => get<Facets>('/public/products/facets', { type }) });
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: () => get<{ items: Branch[] }>('/public/branches') });
  const products = useQuery({
    queryKey: ['products', type, params.toString()],
    queryFn: () => get<Paginated<ProductSummary>>('/public/products', { ...filters, type, limit: 12 }),
    placeholderData: keepPreviousData,
  });

  const activeCount =
    filters.brand.length + filters.category.length + filters.ram.length + filters.storage.length + filters.availability.length + (filters.minPrice || filters.maxPrice ? 1 : 0) + (filters.branch ? 1 : 0);

  const pricePresets = useMemo(
    () =>
      isMobile
        ? [
            { l: 'Under ₹10k', min: '', max: '10000' },
            { l: '₹10k–20k', min: '10000', max: '20000' },
            { l: '₹20k–35k', min: '20000', max: '35000' },
            { l: '₹35k–60k', min: '35000', max: '60000' },
            { l: 'Above ₹60k', min: '60000', max: '' },
          ]
        : [
            { l: 'Under ₹500', min: '', max: '500' },
            { l: '₹500–1500', min: '500', max: '1500' },
            { l: '₹1500–3000', min: '1500', max: '3000' },
            { l: 'Above ₹3000', min: '3000', max: '' },
          ],
    [isMobile],
  );

  const sidebar = (
    <div className="space-y-5">
      <FilterGroup title="Brand">
        <div className="space-y-2">
          {facets.data?.brands.map((b) => (
            <label key={b.slug} className="flex cursor-pointer items-center justify-between gap-2 text-sm text-slate-700">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={filters.brand.includes(b.slug)} onChange={() => toggle('brand', b.slug)} className="h-4 w-4 rounded accent-violet-600" />
                {b.name}
              </span>
              <span className="text-xs text-slate-400">{b.count}</span>
            </label>
          ))}
        </div>
      </FilterGroup>
      {(facets.data?.categories.length ?? 0) > 1 && (
        <FilterGroup title="Category">
          <div className="flex flex-wrap gap-2">
            {facets.data?.categories.map((c) => (
              <Chip key={c.slug} active={filters.category.includes(c.slug)} onClick={() => toggle('category', c.slug)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      )}
      <FilterGroup title="Price">
        <div className="mb-3 flex flex-wrap gap-2">
          {pricePresets.map((p) => (
            <Chip key={p.l} active={filters.minPrice === p.min && filters.maxPrice === p.max} onClick={() => update({ minPrice: p.min, maxPrice: p.max })}>
              {p.l}
            </Chip>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            update({ minPrice: String(fd.get('min') ?? ''), maxPrice: String(fd.get('max') ?? '') });
          }}
        >
          <input name="min" type="number" min={0} defaultValue={filters.minPrice} key={`min-${filters.minPrice}`} placeholder={facets.data ? inr(facets.data.price.min) : 'Min'} className="input py-2" aria-label="Minimum price" />
          <span className="text-slate-400">–</span>
          <input name="max" type="number" min={0} defaultValue={filters.maxPrice} key={`max-${filters.maxPrice}`} placeholder={facets.data ? inr(facets.data.price.max) : 'Max'} className="input py-2" aria-label="Maximum price" />
          <Button size="sm" variant="secondary" type="submit">Go</Button>
        </form>
      </FilterGroup>
      {isMobile && (facets.data?.ram.length ?? 0) > 0 && (
        <FilterGroup title="RAM">
          <div className="flex flex-wrap gap-2">
            {facets.data?.ram.map((r) => (
              <Chip key={r} active={filters.ram.includes(String(r))} onClick={() => toggle('ram', String(r))}>
                {gb(r)}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      )}
      {isMobile && (facets.data?.storage.length ?? 0) > 0 && (
        <FilterGroup title="Storage">
          <div className="flex flex-wrap gap-2">
            {facets.data?.storage.map((s) => (
              <Chip key={s} active={filters.storage.includes(String(s))} onClick={() => toggle('storage', String(s))}>
                {gb(s)}
              </Chip>
            ))}
          </div>
        </FilterGroup>
      )}
      <FilterGroup title="Availability">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STOCK_META) as StockStatus[]).map((s) => (
            <Chip key={s} active={filters.availability.includes(s)} onClick={() => toggle('availability', s)}>
              {STOCK_META[s].label}
            </Chip>
          ))}
        </div>
      </FilterGroup>
      {(branches.data?.items.length ?? 0) > 1 && (
        <FilterGroup title="Available at branch">
          <select className="input" value={filters.branch} onChange={(e) => update({ branch: e.target.value })}>
            <option value="">All branches</option>
            {branches.data?.items.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </FilterGroup>
      )}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setParams(filters.search ? { search: filters.search } : {})}>
          <X className="h-4 w-4" /> Clear all filters
        </Button>
      )}
    </div>
  );

  const title = isMobile ? 'All Mobiles' : 'Accessories';
  const data = products.data;

  return (
    <>
      <Seo title={title} description={isMobile ? 'Browse smartphones by brand, price, RAM and storage.' : 'Chargers, earbuds, covers, screen guards, power banks and smart watches.'} />
      <section className="relative overflow-hidden bg-navy-950 py-12 text-white sm:py-16">
        <div className="animated-gradient pointer-events-none absolute inset-0 bg-hero-gradient" />
        <div className="container relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-flame-300">{isMobile ? 'Smartphones' : 'Accessories'}</p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-5xl">{isMobile ? <>Find your <span className="text-gradient">perfect phone</span></> : <>Gear up your <span className="text-gradient">phone</span></>}</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update({ search: searchText.trim() });
            }}
            className="mt-6 flex max-w-xl items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-1.5 backdrop-blur"
          >
            <Search className="ml-3 h-5 w-5 text-slate-300" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={isMobile ? 'Search by name, brand, model, processor…' : 'Search accessories…'}
              className="h-11 flex-1 bg-transparent text-white outline-none placeholder:text-slate-400"
              aria-label="Search products"
            />
            <Button type="submit" size="sm">Search</Button>
          </form>
        </div>
      </section>

      <div className="container py-8 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block">
            <div className="card sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto p-5">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-navy-900">
                <SlidersHorizontal className="h-4 w-4 text-violet-500" /> Filters
              </h2>
              {sidebar}
            </div>
          </aside>

          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {data ? (
                  <>
                    <span className="font-semibold text-navy-900">{data.pagination.total}</span> products
                    {filters.search && <> for “{filters.search}”</>}
                  </>
                ) : (
                  'Loading…'
                )}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setDrawer(true)}>
                  <Filter className="h-4 w-4" /> Filters {activeCount > 0 && `(${activeCount})`}
                </Button>
                <select value={filters.sort} onChange={(e) => update({ sort: e.target.value })} className="input h-9 w-auto py-0" aria-label="Sort products">
                  {SORTS.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {products.error ? (
              <ErrorState error={products.error} onRetry={products.refetch} />
            ) : !data ? (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
            ) : data.items.length === 0 ? (
              <EmptyState title="No products match your filters" text="Try removing a filter or searching for something else." action={<Button variant="outline" onClick={() => setParams({})}>Reset filters</Button>} />
            ) : (
              <div className={cn('grid grid-cols-2 gap-3 transition-opacity sm:gap-4 xl:grid-cols-3', products.isFetching && 'opacity-60')}>
                {data.items.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
            {data && (
              <div className="mt-10">
                <Pagination
                  page={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  onChange={(p) => {
                    update({ page: p }, false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-[70] bg-navy-950/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)}>
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="h-full w-[86vw] max-w-sm overflow-y-auto bg-white p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-navy-900">Filters</h2>
                <button onClick={() => setDrawer(false)} aria-label="Close filters" className="rounded-lg p-1.5 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebar}
              <Button className="mt-6 w-full" onClick={() => setDrawer(false)}>
                Show {data?.pagination.total ?? ''} results
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
