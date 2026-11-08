import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Reveal } from '@/components/motion';
import { PageHeader } from '@/components/PageHeader';
import { Seo } from '@/components/Seo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { get, imageSrc } from '@/lib/api';
import type { Brand } from '@/types';

export default function Brands() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['public', 'brands'], queryFn: () => get<{ items: Brand[] }>('/public/brands') });
  return (
    <>
      <Seo title="Brands" description="Shop smartphones and accessories by brand at Sakshi Mobile." />
      <PageHeader eyebrow="Brands" title={<>Shop by <span className="text-gradient">brand</span></>} text="All the brands you love, under one roof." crumbs={[{ label: 'Brands' }]} />
      <section className="container py-12">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-56 rounded-3xl" />)}</div>
        ) : !data?.items.length ? (
          <EmptyState title="No brands yet" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.map((b, i) => (
              <Reveal key={b.id} delay={i * 0.04}>
                <Link
                  to={`/brands/${b.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 shadow-card transition hover:-translate-y-1.5 hover:shadow-card-hover"
                  style={{ ['--accent' as string]: b.accentColor ?? '#2563FF' }}
                >
                  <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-2xl transition duration-500 group-hover:scale-150" style={{ background: 'var(--accent)' }} />
                  {b.logoUrl ? (
                    <img src={imageSrc(b.logoUrl, 240)} alt={b.name} className="relative h-14 w-14 object-contain" loading="lazy" />
                  ) : (
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-extrabold text-white shadow-lg" style={{ background: 'linear-gradient(135deg, var(--accent), #7C3AED)' }}>
                      {b.name[0]}
                    </span>
                  )}
                  <h2 className="relative mt-5 text-xl font-bold text-navy-900">{b.name}</h2>
                  <p className="relative mt-1 line-clamp-2 flex-1 text-sm text-slate-500">{b.description}</p>
                  <p className="relative mt-4 flex items-center justify-between text-sm font-semibold text-electric-600">
                    {b.productCount ?? 0} products <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
