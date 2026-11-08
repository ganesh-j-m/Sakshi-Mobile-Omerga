import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { OfferCard } from '@/components/OfferCard';
import { PageHeader } from '@/components/PageHeader';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { Seo } from '@/components/Seo';
import { EmptyState, PageLoader, Pagination, SectionHeading, buttonClass } from '@/components/ui';
import { get, imageSrc } from '@/lib/api';
import { cn } from '@/lib/cn';
import { inr } from '@/lib/format';
import type { Brand, Offer, Paginated, ProductSummary } from '@/types';

type Resp = { brand: Brand; stats: { total: number; min: number | null; max: number | null }; offers: Offer[]; branches: { name: string; slug: string; city: string }[] };

export default function BrandDetails() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1);
  const type = params.get('type') ?? '';
  const sort = params.get('sort') ?? 'featured';

  const brand = useQuery({ queryKey: ['brand', slug], queryFn: () => get<Resp>(`/public/brands/${slug}`) });
  const products = useQuery({
    queryKey: ['brand-products', slug, page, type, sort],
    queryFn: () => get<Paginated<ProductSummary>>('/public/products', { brand: slug, page, type, sort, limit: 12 }),
    placeholderData: keepPreviousData,
  });

  if (brand.isLoading) return <PageLoader />;
  if (!brand.data) return <div className="container py-20"><EmptyState title="Brand not found" action={<Link to="/brands" className={buttonClass()}>All brands</Link>} /></div>;
  const { brand: b, stats, offers, branches } = brand.data;
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n);
  };

  return (
    <>
      <Seo title={`${b.name} Mobiles & Accessories`} description={b.description ?? `${b.name} smartphones at Sakshi Mobile.`} image={b.bannerUrl} />
      <PageHeader
        eyebrow="Brand"
        title={b.name}
        text={b.description}
        crumbs={[{ to: '/brands', label: 'Brands' }, { label: b.name }]}
      >
        <div className="mt-6 flex flex-wrap gap-3">
          {b.logoUrl && <img src={imageSrc(b.logoUrl, 160)} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1.5" />}
          <span className="glass rounded-2xl px-4 py-2 text-sm"><b>{stats.total}</b> products</span>
          {stats.min != null && <span className="glass rounded-2xl px-4 py-2 text-sm">From <b>{inr(stats.min)}</b></span>}
        </div>
      </PageHeader>
      {b.bannerUrl && (
        <div className="container -mt-6 relative z-10">
          <img src={imageSrc(b.bannerUrl, 1400)} alt="" className="h-48 w-full rounded-3xl object-cover shadow-card sm:h-64" />
        </div>
      )}

      <section className="container py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {[
              { v: '', l: 'All' },
              { v: 'MOBILE', l: 'Mobiles' },
              { v: 'ACCESSORY', l: 'Accessories' },
            ].map((t) => (
              <button key={t.l} onClick={() => set('type', t.v)} className={cn('rounded-xl px-4 py-2 text-sm font-semibold transition', type === t.v ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
                {t.l}
              </button>
            ))}
          </div>
          <select className="input h-10 w-auto py-0" value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
            <option value="featured">Featured</option>
            <option value="latest">Latest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
        {!products.data ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        ) : products.data.items.length === 0 ? (
          <EmptyState title={`No ${b.name} products listed yet`} text="Ask us on WhatsApp — we may have it in store." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {products.data.items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
        {products.data && (
          <div className="mt-10">
            <Pagination page={products.data.pagination.page} totalPages={products.data.pagination.totalPages} onChange={(p) => set('page', String(p))} />
          </div>
        )}
      </section>

      {offers.length > 0 && (
        <section className="container pb-12">
          <SectionHeading eyebrow="Offers" title={`${b.name} offers`} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{offers.map((o, i) => <OfferCard key={o.id} offer={o} index={i} />)}</div>
        </section>
      )}

      {branches.length > 0 && (
        <section className="container pb-16">
          <h2 className="mb-4 text-lg font-semibold text-navy-900">Available at</h2>
          <div className="flex flex-wrap gap-3">
            {branches.map((br) => (
              <Link key={br.slug} to={`/branches/${br.slug}`} className="chip bg-white px-4 py-2 text-sm text-navy-800 shadow-sm ring-1 ring-slate-200 hover:ring-electric-400">
                <MapPin className="h-4 w-4 text-violet-500" /> {br.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
