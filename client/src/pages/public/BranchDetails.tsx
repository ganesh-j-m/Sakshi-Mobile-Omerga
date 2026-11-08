import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { directionsUrl } from '@/components/BranchCard';
import { InquiryForm } from '@/components/InquiryForm';
import { Reveal } from '@/components/motion';
import { OfferCard } from '@/components/OfferCard';
import { PageHeader } from '@/components/PageHeader';
import { ProductCard } from '@/components/ProductCard';
import { Seo } from '@/components/Seo';
import { DemoBadge, EmptyState, LinkButton, PageLoader, SectionHeading, buttonClass } from '@/components/ui';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { get, imageSrc } from '@/lib/api';
import { cn } from '@/lib/cn';
import { BRANCH_TYPE_LABEL, fmt12, telHref } from '@/lib/format';
import type { Branch, Offer, ProductSummary } from '@/types';

type Resp = {
  branch: Branch;
  brands: { name: string; slug: string; logoUrl: string | null; accentColor: string | null }[];
  offers: Offer[];
  products: ProductSummary[];
  productCount: number;
};

export default function BranchDetails() {
  const { slug = '' } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['branch', slug], queryFn: () => get<Resp>(`/public/branches/${slug}`) });
  if (isLoading) return <PageLoader />;
  if (!data) return <div className="container py-20"><EmptyState title="Branch not found" action={<Link to="/branches" className={buttonClass()}>All branches</Link>} /></div>;

  const { branch: b, brands, offers, products, productCount } = data;
  const address = [b.addressLine, b.city, b.district, b.state, b.pincode].filter(Boolean).join(', ');
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const mapQuery = b.latitude != null && b.longitude != null ? `${b.latitude},${b.longitude}` : `${b.name} ${b.city} ${b.state}`;

  return (
    <>
      <Seo
        title={`${b.name} — ${b.city}`}
        description={`${b.name}: address, timings, available phones, offers and directions.`}
        image={b.imageUrl}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'MobilePhoneStore',
          name: b.name,
          image: b.imageUrl ?? undefined,
          address: { '@type': 'PostalAddress', streetAddress: b.addressLine, addressLocality: b.city, addressRegion: b.state, postalCode: b.pincode, addressCountry: 'IN' },
          ...(b.phone ? { telephone: b.phone } : {}),
          ...(b.latitude != null && b.longitude != null ? { geo: { '@type': 'GeoCoordinates', latitude: b.latitude, longitude: b.longitude } } : {}),
          openingHoursSpecification: b.openingHours
            .filter((h) => !h.closed && h.open && h.close)
            .map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.day, opens: h.open, closes: h.close })),
        }}
      />
      <PageHeader eyebrow={BRANCH_TYPE_LABEL[b.type]} title={b.name} text={address} crumbs={[{ to: '/branches', label: 'Branches' }, { label: b.name }]}>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={directionsUrl(b)} target="_blank" rel="noopener noreferrer" className={buttonClass('primary')}>
            <Navigation className="h-4 w-4" /> Get directions
          </a>
          <WhatsAppButton number={b.whatsapp} context={{ kind: 'branch', branch: b }}>WhatsApp this branch</WhatsAppButton>
          {b.phone && (
            <a href={telHref(b.phone)} className={buttonClass('light')}>
              <Phone className="h-4 w-4" /> Call
            </a>
          )}
          {b.isDemo && <DemoBadge label="Details pending verification" className="self-center" />}
        </div>
      </PageHeader>

      <section className="container grid gap-8 py-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {b.imageUrl && <img src={imageSrc(b.imageUrl, 1400)} alt={b.name} className="h-72 w-full rounded-3xl object-cover shadow-card" />}
          {b.intro && (
            <Reveal className="card p-6">
              <h2 className="text-lg font-semibold text-navy-900">About this branch</h2>
              <p className="mt-2 whitespace-pre-line text-slate-600">{b.intro}</p>
            </Reveal>
          )}
          <Reveal className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
            <iframe
              title={`Map of ${b.name}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
              className="h-80 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </Reveal>
          {b.services.length > 0 && (
            <Reveal className="card p-6">
              <h2 className="mb-4 text-lg font-semibold text-navy-900">Services available</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {b.services.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" /> {s}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
          {brands.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-navy-900">Brands at this store</h2>
              <div className="flex flex-wrap gap-2">
                {brands.map((br) => (
                  <Link key={br.slug} to={`/brands/${br.slug}`} className="chip bg-white px-4 py-2 text-sm text-navy-800 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-electric-400">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: br.accentColor ?? '#2563FF' }} />
                    {br.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-semibold text-navy-900">Contact details</h2>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-violet-500" /> {address}</li>
              {b.phone && <li><a href={telHref(b.phone)} className="flex gap-3 hover:text-electric-600"><Phone className="h-5 w-5 text-violet-500" /> {b.phone}</a></li>}
              {b.email && <li><a href={`mailto:${b.email}`} className="flex gap-3 hover:text-electric-600"><Mail className="h-5 w-5 text-violet-500" /> {b.email}</a></li>}
              {!b.phone && !b.email && <li className="text-slate-400">Phone & email will be published once verified.</li>}
            </ul>
          </div>
          <div className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-navy-900"><Clock className="h-5 w-5 text-violet-500" /> Opening hours</h2>
            {b.openingHours.some((h) => h.closed || (h.open && h.close)) ? (
              <ul className="space-y-1.5 text-sm">
                {b.openingHours.map((h) => (
                  <li key={h.day} className={cn('flex justify-between rounded-xl px-3 py-2', h.day === today ? 'bg-electric-50 font-semibold text-electric-700' : 'text-slate-600')}>
                    <span>{h.day}</span>
                    <span>{h.closed ? 'Closed' : h.open && h.close ? `${fmt12(h.open)} – ${fmt12(h.close)}` : '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Timings will be updated soon.</p>
            )}
          </div>
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-semibold text-navy-900">Send an inquiry</h2>
            <InquiryForm compact branchId={b.id} defaultType="BRANCH" />
          </div>
        </aside>
      </section>

      {offers.length > 0 && (
        <section className="container pb-12">
          <SectionHeading eyebrow="Branch offers" title={`Offers at ${b.name}`} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{offers.map((o, i) => <OfferCard key={o.id} offer={o} index={i} whatsapp={b.whatsapp} />)}</div>
        </section>
      )}

      {products.length > 0 && (
        <section className="bg-gradient-to-b from-slate-50 to-white py-12">
          <div className="container">
            <SectionHeading
              eyebrow="Available here"
              title="Products at this branch"
              text={`${productCount} products listed at this store.`}
              action={<LinkButton to={`/mobiles?branch=${b.slug}`} variant="outline" size="sm">View all</LinkButton>}
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}
