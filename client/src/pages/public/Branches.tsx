import { useQuery } from '@tanstack/react-query';
import { BranchCard } from '@/components/BranchCard';
import { PageHeader } from '@/components/PageHeader';
import { Seo } from '@/components/Seo';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { get } from '@/lib/api';
import type { Branch } from '@/types';

export default function Branches() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['public', 'branches'], queryFn: () => get<{ items: Branch[] }>('/public/branches') });
  return (
    <>
      <Seo
        title="Our Branches"
        description="Find a Sakshi Mobile store — address, timings, directions and WhatsApp."
        jsonLd={data?.items.map((b) => ({
          '@context': 'https://schema.org',
          '@type': 'MobilePhoneStore',
          name: b.name,
          address: { '@type': 'PostalAddress', streetAddress: b.addressLine, addressLocality: b.city, addressRegion: b.state, postalCode: b.pincode, addressCountry: 'IN' },
          ...(b.phone ? { telephone: b.phone } : {}),
          ...(b.latitude != null && b.longitude != null ? { geo: { '@type': 'GeoCoordinates', latitude: b.latitude, longitude: b.longitude } } : {}),
        }))}
      />
      <PageHeader eyebrow="Branches" title={<>Visit a <span className="text-gradient">Sakshi Mobile</span> store</>} text="Hands-on demos, honest advice and after-sales help near you." crumbs={[{ label: 'Branches' }]} />
      <section className="container py-12">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-96 rounded-3xl" />)}</div>
        ) : !data?.items.length ? (
          <EmptyState title="No branches listed yet" />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((b, i) => <BranchCard key={b.id} branch={b} index={i} />)}
          </div>
        )}
      </section>
    </>
  );
}
