import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Battery, Camera, Check, ChevronRight, Cpu, GitCompareArrows, HardDrive, MapPin, MemoryStick, ShieldCheck, Smartphone, Store } from 'lucide-react';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { A11y, Navigation } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import { InquiryForm } from '@/components/InquiryForm';
import { OfferCard } from '@/components/OfferCard';
import { ProductCard } from '@/components/ProductCard';
import { ProductMedia } from '@/components/ProductMedia';
import { Reveal } from '@/components/motion';
import { Seo } from '@/components/Seo';
import { Button, DemoBadge, EmptyState, PageLoader, SectionHeading, StockBadge, buttonClass } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { useCompare } from '@/context/compare';
import { ApiError, assetUrl, get } from '@/lib/api';
import { cn } from '@/lib/cn';
import { discountPct, effectivePrice, gb, inr } from '@/lib/format';
import type { Offer, ProductDetail, ProductSummary } from '@/types';

type Resp = { product: ProductDetail; related: ProductSummary[]; offers: Offer[] };

function ZoomImage({ url, alt, type, color, categorySlug }: { url?: string | null; alt: string; type: 'MOBILE' | 'ACCESSORY'; color?: string; categorySlug?: string }) {
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  return (
    <div
      className={cn('relative flex h-full w-full items-center justify-center overflow-hidden', url && 'cursor-zoom-in')}
      onMouseMove={url ? onMove : undefined}
      onMouseLeave={() => setZoom(null)}
    >
      <div
        className="flex h-full w-full items-center justify-center transition-transform duration-200 ease-out"
        style={zoom ? { transform: 'scale(2)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
      >
        <ProductMedia url={url} alt={alt} type={type} color={color} categorySlug={categorySlug} eager sizes="(max-width: 1024px) 100vw, 50vw" />
      </div>
    </div>
  );
}

export default function ProductDetails() {
  const { slug = '' } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['product', slug], queryFn: () => get<Resp>(`/public/products/${slug}`) });
  const compare = useCompare();
  const { notify } = useToast();
  const [active, setActive] = useState(0);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [branchId, setBranchId] = useState<number | null>(null);

  const p = data?.product;
  useEffect(() => {
    setActive(0);
    setVariantId(p?.variants[0]?.id ?? null);
    setBranchId(p?.availability[0]?.branch.id ?? null);
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const variant = p?.variants.find((v) => v.id === variantId) ?? p?.variants[0];
  const gallery = useMemo(() => {
    if (!p) return [] as { url: string | null; alt: string }[];
    const imgs = p.images.map((i) => ({ url: i.url, alt: i.alt ?? p.name }));
    if (variant?.imageUrl) imgs.unshift({ url: variant.imageUrl, alt: `${p.name} – ${variant.colorName}` });
    return imgs.length ? imgs : [{ url: null, alt: p.name }];
  }, [p, variant]);

  if (isLoading) return <PageLoader />;
  if (error || !p) {
    return (
      <div className="container py-20">
        <EmptyState
          title={error instanceof ApiError && error.status === 404 ? 'Product not found' : 'Could not load product'}
          text="It may have been removed or renamed."
          action={<Link to="/mobiles" className={buttonClass('primary')}>Browse mobiles</Link>}
        />
      </div>
    );
  }

  const isMobile = p.category.type === 'MOBILE';
  const price = effectivePrice(p);
  const off = discountPct(p);
  const branch = p.availability.find((a) => a.branch.id === branchId)?.branch;
  const inCompare = compare.has(p.slug);
  const specs = [
    { Icon: MemoryStick, label: 'RAM', value: gb(p.ramGb) },
    { Icon: HardDrive, label: 'Storage', value: gb(p.storageGb) },
    { Icon: Smartphone, label: 'Display', value: p.display },
    { Icon: Camera, label: 'Camera', value: p.camera },
    { Icon: Battery, label: 'Battery', value: p.battery },
    { Icon: Cpu, label: 'Processor', value: p.processor },
  ].filter((s) => s.value);

  return (
    <>
      <Seo
        title={p.metaTitle || `${p.name}${p.ramGb ? ` (${gb(p.ramGb)} / ${gb(p.storageGb)})` : ''}`}
        description={p.metaDescription || `${p.name} at ${inr(price)}. ${[p.display, p.camera, p.battery].filter(Boolean).join(' · ')}`}
        image={p.images[0]?.url ? assetUrl(p.images[0].url) : undefined}
        type="product"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.name,
          sku: p.sku,
          brand: { '@type': 'Brand', name: p.brand.name },
          description: p.description ?? undefined,
          image: p.images.map((i) => assetUrl(i.url)),
          offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price,
            availability:
              p.stockStatus === 'OUT_OF_STOCK'
                ? 'https://schema.org/OutOfStock'
                : p.stockStatus === 'PRE_ORDER'
                  ? 'https://schema.org/PreOrder'
                  : 'https://schema.org/InStock',
          },
        }}
      />

      <div className="border-b border-slate-200 bg-white">
        <nav className="container flex items-center gap-1.5 overflow-x-auto py-3 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-electric-600">Home</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link to={isMobile ? '/mobiles' : '/accessories'} className="hover:text-electric-600">{isMobile ? 'Mobiles' : 'Accessories'}</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link to={`/brands/${p.brand.slug}`} className="hover:text-electric-600">{p.brand.name}</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium text-navy-900">{p.name}</span>
        </nav>
      </div>

      <section className="container grid gap-10 py-8 lg:grid-cols-2 lg:py-12">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-50 via-electric-50/50 to-violet-100/60 p-8 shadow-card ring-1 ring-slate-200/70">
            <div className="absolute inset-x-16 bottom-10 h-16 rounded-full bg-violet-500/25 blur-3xl" />
            {off > 0 && <span className="chip absolute left-5 top-5 z-10 bg-gradient-to-r from-flame-500 to-rose-500 text-white">{off}% OFF</span>}
            <AnimatePresence mode="wait">
              <motion.div key={`${active}-${variant?.id}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="relative h-full w-full">
                <ZoomImage url={gallery[active]?.url} alt={gallery[active]?.alt ?? p.name} type={p.category.type} color={variant?.colorHex} categorySlug={p.category.slug} />
              </motion.div>
            </AnimatePresence>
          </div>
          {gallery.length > 1 && (
            <div className="scrollbar-none mt-4 flex gap-3 overflow-x-auto pb-1">
              {gallery.map((g, i) => (
                <button
                  key={`${g.url}-${i}`}
                  onClick={() => setActive(i)}
                  aria-label={`Image ${i + 1}`}
                  className={cn('h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white p-2 transition', i === active ? 'border-electric-500 shadow-glow' : 'border-slate-200 hover:border-slate-300')}
                >
                  <ProductMedia url={g.url} alt="" type={p.category.type} color={variant?.colorHex} />
                </button>
              ))}
            </div>
          )}
          {p.images.length > 0 && <p className="mt-2 hidden text-xs text-slate-400 lg:block">Hover over the image to zoom</p>}
        </div>

        {/* Info */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/brands/${p.brand.slug}`} className="chip bg-violet-50 text-violet-700 hover:bg-violet-100">{p.brand.name}</Link>
            <span className="chip bg-slate-100 text-slate-600">{p.category.name}</span>
            <StockBadge status={variant?.stockStatus ?? p.stockStatus} />
            {p.isDemo && <DemoBadge />}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">{p.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Product code: {p.sku}{p.model && p.model !== p.sku ? ` · Model: ${p.model}` : ''}</p>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <span className="text-4xl font-extrabold text-navy-900">{inr(price)}</span>
            {p.mrp > price && <span className="pb-1 text-lg text-slate-400 line-through">MRP {inr(p.mrp)}</span>}
            {p.offerPrice != null && p.offerPrice < p.sellingPrice && (
              <span className="mb-1 chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Offer price · save {inr(p.mrp - price)}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">Inclusive of all taxes. Prices may vary by branch — please confirm in store.</p>

          {p.variants.length > 0 && (
            <div className="mt-7">
              <p className="mb-3 text-sm font-semibold text-navy-900">
                Colour: <span className="font-normal text-slate-600">{variant?.colorName}</span>
              </p>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Choose colour">
                {p.variants.map((v) => (
                  <button
                    key={v.id}
                    role="radio"
                    aria-checked={v.id === variant?.id}
                    onClick={() => {
                      setVariantId(v.id);
                      setActive(0);
                    }}
                    className={cn(
                      'flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-sm font-medium transition',
                      v.id === variant?.id ? 'border-electric-500 bg-electric-50 text-navy-900' : 'border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    <span className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: v.colorHex }} />
                    {v.colorName}
                    {v.id === variant?.id && <Check className="h-4 w-4 text-electric-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {p.availability.length > 0 && (
            <div className="mt-7">
              <label htmlFor="branch-select" className="mb-2 block text-sm font-semibold text-navy-900">Enquire at branch</label>
              <select id="branch-select" className="input" value={branchId ?? ''} onChange={(e) => setBranchId(Number(e.target.value) || null)}>
                {p.availability.map((a) => (
                  <option key={a.branch.id} value={a.branch.id}>
                    {a.branch.name} — {a.stockStatus.replace('_', ' ').toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <WhatsAppButton
              size="lg"
              number={branch?.whatsapp}
              context={{ kind: 'product', product: p, color: variant?.colorName, branchName: branch?.name }}
              className="sm:col-span-2"
            >
              Enquire on WhatsApp
            </WhatsAppButton>
            <Button
              variant={inCompare ? 'secondary' : 'outline'}
              onClick={() => {
                const r = compare.toggle({ slug: p.slug, name: p.name });
                notify(r === 'full' ? `Compare holds up to ${compare.max} products` : r === 'added' ? 'Added to compare' : 'Removed from compare', 'info');
              }}
            >
              <GitCompareArrows className="h-4 w-4" /> {inCompare ? 'In compare' : 'Add to compare'}
            </Button>
            {isMobile && (
              <div className="grid grid-cols-2 gap-3">
                <WhatsAppButton variant="outline" number={branch?.whatsapp} context={{ kind: 'exchange', productName: p.name }}>Exchange</WhatsAppButton>
                <WhatsAppButton variant="outline" number={branch?.whatsapp} context={{ kind: 'emi', productName: p.name }}>EMI</WhatsAppButton>
              </div>
            )}
          </div>

          {specs.length > 0 && (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {specs.map(({ Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-card">
                  <Icon className="h-5 w-5 text-violet-500" />
                  <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold text-navy-900">{value}</p>
                </div>
              ))}
            </div>
          )}

          {p.warranty && (
            <p className="mt-6 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <ShieldCheck className="h-5 w-5" /> {p.warranty}
            </p>
          )}

          {p.highlights.length > 0 && (
            <ul className="mt-6 space-y-2">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-sm text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {h}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy-900">
              <Store className="h-5 w-5 text-violet-500" /> Branch availability
            </h2>
            {p.availability.length === 0 ? (
              <p className="text-sm text-slate-500">Availability not listed yet — please enquire on WhatsApp.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {p.availability.map((a) => (
                  <li key={a.branch.id} className="flex items-center justify-between gap-3 py-3">
                    <Link to={`/branches/${a.branch.slug}`} className="flex items-center gap-2 text-sm font-medium text-navy-900 hover:text-electric-600">
                      <MapPin className="h-4 w-4 text-slate-400" /> {a.branch.name}
                    </Link>
                    <div className="flex items-center gap-2">
                      {a.branchPrice != null && <span className="text-sm font-semibold">{inr(a.branchPrice)}</span>}
                      <StockBadge status={a.stockStatus} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="container grid gap-8 pb-12 lg:grid-cols-[1.4fr_1fr]">
        <Reveal className="card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-navy-900">About this product</h2>
          <p className="mt-3 whitespace-pre-line text-slate-600">{p.description || 'Details coming soon.'}</p>
          <h3 className="mt-8 text-lg font-semibold text-navy-900">Specifications</h3>
          <dl className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
            {[
              ['Brand', p.brand.name],
              ['Model', p.model],
              ['Category', p.category.name],
              ['RAM', gb(p.ramGb)],
              ['Storage', gb(p.storageGb)],
              ['Display', p.display],
              ['Camera', p.camera],
              ['Battery', p.battery],
              ['Processor', p.processor],
              ['Colours', p.variants.map((v) => v.colorName).join(', ')],
              ['Warranty', p.warranty],
            ]
              .filter(([, v]) => v)
              .map(([k, v], i) => (
                <div key={k} className={cn('grid grid-cols-3 gap-4 px-4 py-3 text-sm', i % 2 === 0 && 'bg-slate-50/70')}>
                  <dt className="font-medium text-slate-500">{k}</dt>
                  <dd className="col-span-2 text-navy-900">{v}</dd>
                </div>
              ))}
          </dl>
        </Reveal>
        <Reveal delay={0.1} className="card h-fit p-6 sm:p-8">
          <h2 className="mb-4 text-xl font-bold text-navy-900">Send an inquiry</h2>
          <InquiryForm compact productId={p.id} productName={p.name} branchId={branchId ?? undefined} defaultType="PRODUCT" />
        </Reveal>
      </section>

      {data.offers.length > 0 && (
        <section className="container pb-12">
          <SectionHeading eyebrow="Offers" title="Offers on this product" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.offers.map((o, i) => (
              <OfferCard key={o.id} offer={o} index={i} whatsapp={branch?.whatsapp} />
            ))}
          </div>
        </section>
      )}

      {data.related.length > 0 && (
        <section className="bg-gradient-to-b from-slate-50 to-white py-14">
          <div className="container">
            <SectionHeading eyebrow="You may also like" title="Related products" />
            <Swiper modules={[Navigation, A11y]} navigation spaceBetween={16} slidesPerView={1.3} breakpoints={{ 480: { slidesPerView: 2 }, 900: { slidesPerView: 3 }, 1200: { slidesPerView: 4 } }} className="!px-1 !py-3">
              {data.related.map((r, i) => (
                <SwiperSlide key={r.id} className="!h-auto">
                  <ProductCard product={r} index={i} />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </section>
      )}
    </>
  );
}
