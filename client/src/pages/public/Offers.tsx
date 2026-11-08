import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { OfferCard } from '@/components/OfferCard';
import { PageHeader } from '@/components/PageHeader';
import { Seo } from '@/components/Seo';
import { DemoBadge, EmptyState, ErrorState, LinkButton, Skeleton } from '@/components/ui';
import { get, imageSrc } from '@/lib/api';
import { cn } from '@/lib/cn';
import { OFFER_TYPE_LABEL } from '@/lib/format';
import type { Banner, Branch, Offer, OfferType } from '@/types';

export default function Offers() {
  const [params, setParams] = useSearchParams();
  const type = params.get('type') ?? '';
  const branch = params.get('branch') ?? '';
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public', 'offers', type, branch],
    queryFn: () => get<{ items: Offer[]; banners: Banner[] }>('/public/offers', { type, branch }),
  });
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: () => get<{ items: Branch[] }>('/public/branches') });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n);
  };

  return (
    <>
      <Seo title="Latest Offers" description="Current mobile offers, exchange deals and EMI options at Sakshi Mobile." />
      <PageHeader eyebrow="Offers" title={<>Latest <span className="text-gradient">offers</span></>} text="Exchange deals, EMI inquiries, combo discounts and festive specials." crumbs={[{ label: 'Offers' }]} />

      {data?.banners[0] && (
        <div className="container relative z-10 -mt-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-electric-600 via-violet-600 to-flame-500 p-8 text-white shadow-card">
            {data.banners[0].imageUrl && <img src={imageSrc(data.banners[0].imageUrl, 1400)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
            <div className="relative">
              {data.banners[0].isDemo && <DemoBadge className="mb-2" />}
              <h2 className="text-2xl font-bold">{data.banners[0].title}</h2>
              {data.banners[0].subtitle && <p className="mt-1 text-white/85">{data.banners[0].subtitle}</p>}
              {data.banners[0].ctaLink && data.banners[0].ctaLabel && (
                <LinkButton to={data.banners[0].ctaLink} variant="light" size="sm" className="mt-4">{data.banners[0].ctaLabel}</LinkButton>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="container py-10">
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {['', ...(Object.keys(OFFER_TYPE_LABEL) as OfferType[])].map((t) => (
            <button
              key={t || 'all'}
              onClick={() => set('type', t)}
              className={cn('rounded-xl px-4 py-2 text-sm font-semibold transition', type === t ? 'bg-gradient-to-r from-electric-500 to-violet-500 text-white shadow-glow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}
            >
              {t ? OFFER_TYPE_LABEL[t as OfferType] : 'All offers'}
            </button>
          ))}
          {(branches.data?.items.length ?? 0) > 1 && (
            <select value={branch} onChange={(e) => set('branch', e.target.value)} className="input ml-auto h-10 w-auto py-0" aria-label="Filter by branch">
              <option value="">All branches</option>
              {branches.data?.items.map((b) => <option key={b.id} value={b.slug}>{b.name}</option>)}
            </select>
          )}
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-80 rounded-3xl" />)}</div>
        ) : !data?.items.length ? (
          <EmptyState title="No active offers right now" text="New offers are added regularly — check back soon or ask us on WhatsApp." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((o, i) => <OfferCard key={o.id} offer={o} index={i} />)}
          </div>
        )}
      </section>
    </>
  );
}
