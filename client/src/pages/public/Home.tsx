import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, CreditCard, Mail, MapPin, Phone, Quote, RefreshCw, Star, UserRound, Zap } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { A11y, Autoplay, Navigation, Pagination as SwiperPagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import { BranchCard } from '@/components/BranchCard';
import { DynamicIcon } from '@/components/DynamicIcon';
import { InquiryForm } from '@/components/InquiryForm';
import { AnimatedCounter, Reveal } from '@/components/motion';
import { OfferCard } from '@/components/OfferCard';
import { PhoneArt, PhoneBackArt } from '@/components/PhoneArt';
import { ProductCard, ProductCardSkeleton } from '@/components/ProductCard';
import { Seo } from '@/components/Seo';
import { DemoBadge, ErrorState, LinkButton, SectionHeading, buttonClass } from '@/components/ui';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { useSite } from '@/hooks/useSite';
import { get, imageSrc } from '@/lib/api';
import { cn } from '@/lib/cn';
import { telHref } from '@/lib/format';
import type { Banner, HomeData } from '@/types';

const BANNER_THEMES: Record<string, string> = {
  blue: 'from-electric-600 via-electric-500 to-violet-600',
  purple: 'from-violet-700 via-violet-500 to-fuchsia-500',
  orange: 'from-flame-500 via-rose-500 to-violet-600',
  navy: 'from-navy-900 via-navy-700 to-electric-700',
  pink: 'from-rose-500 via-fuchsia-500 to-violet-600',
  green: 'from-emerald-500 via-teal-500 to-electric-600',
};

function Hero({ data }: { data?: HomeData }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yPhones = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const hero = data?.hero;

  return (
    <section ref={ref} className="relative overflow-hidden bg-navy-950 text-white">
      <div className="grid-bg pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="animated-gradient pointer-events-none absolute inset-0 bg-hero-gradient" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-electric-500/30 blur-3xl"
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-0 h-[28rem] w-[28rem] rounded-full bg-flame-500/20 blur-3xl"
        animate={reduce ? undefined : { x: [0, -30, 0], y: [0, 30, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="container relative grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-flame-300 backdrop-blur"
          >
            <Zap className="h-3.5 w-3.5" /> {hero?.eyebrow ?? 'Omerga’s smartphone destination'}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
          >
            {hero?.headline ?? 'Your next smartphone,'}{' '}
            <span className="animated-gradient text-gradient">{hero?.highlight ?? 'one tap away.'}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="mt-6 max-w-xl text-base text-slate-300 sm:text-lg"
          >
            {hero?.subheadline}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <LinkButton to={hero?.primaryCtaLink || '/mobiles'} size="lg">
              {hero?.primaryCtaLabel ?? 'Explore Mobiles'} <ArrowRight className="h-5 w-5" />
            </LinkButton>
            <WhatsAppButton size="lg" context={{ kind: 'general' }}>
              {hero?.secondaryCtaLabel ?? 'WhatsApp Inquiry'}
            </WhatsAppButton>
          </motion.div>
          {hero?.badges && hero.badges.length > 0 && (
            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300"
            >
              {hero.badges.map((b) => (
                <li key={b.label} className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-emerald-400" /> {b.label}
                </li>
              ))}
            </motion.ul>
          )}
          {data?.stats && (
            <div className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {[
                { v: data.stats.products, l: 'Products' },
                { v: data.stats.brands, l: 'Brands' },
                { v: data.stats.branches, l: data.stats.branches === 1 ? 'Store' : 'Stores' },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-3xl font-bold text-white">
                    <AnimatedCounter value={s.v} suffix={s.l === 'Products' && s.v > 9 ? '+' : ''} />
                  </p>
                  <p className="text-xs uppercase tracking-wider text-slate-400">{s.l}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <motion.div style={{ y: yPhones }} className="relative mx-auto h-[420px] w-full max-w-[440px] sm:h-[520px]">
          <div className="absolute inset-10 rounded-full bg-gradient-to-tr from-electric-500/40 via-violet-500/40 to-flame-500/40 blur-3xl" />
          <motion.div
            initial={{ opacity: 0, x: 60, rotate: 14 }}
            animate={{ opacity: 1, x: 0, rotate: 12 }}
            transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-2 top-10 h-[300px] sm:h-[380px]"
          >
            <PhoneBackArt className={cn('h-full w-auto', !reduce && 'animate-float-slow')} color="#FF7A18" accent="#7C3AED" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 60, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: -6 }}
            transition={{ delay: 0.2, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-4 top-0 h-[360px] sm:h-[460px]"
          >
            <PhoneArt className={cn('h-full w-auto', !reduce && 'animate-float')} color="#2563FF" accent="#7C3AED" label="Smartphone" />
          </motion.div>
          {[
            { Icon: RefreshCw, t: 'Exchange', c: 'from-violet-500 to-fuchsia-500', pos: 'left-0 bottom-20 sm:-left-6', d: 0.7 },
            { Icon: CreditCard, t: 'EMI inquiry', c: 'from-electric-500 to-cyan-500', pos: 'right-0 bottom-6', d: 0.85 },
            { Icon: BadgeCheck, t: 'Genuine', c: 'from-flame-500 to-rose-500', pos: 'right-6 top-0', d: 1 },
          ].map(({ Icon, t, c, pos, d }) => (
            <motion.div
              key={t}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: d, type: 'spring', stiffness: 200 }}
              className={cn('glass absolute flex items-center gap-2 rounded-2xl px-3.5 py-2.5 shadow-2xl', pos)}
            >
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br', c)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">{t}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function BannerSlide({ b }: { b: Banner }) {
  return (
    <div className={cn('relative flex h-full min-h-[200px] overflow-hidden rounded-3xl bg-gradient-to-br p-8 text-white sm:p-10', BANNER_THEMES[b.theme] ?? BANNER_THEMES.blue)}>
      {b.imageUrl && (
        <picture className="absolute inset-0">
          {b.mobileImageUrl && <source media="(max-width: 640px)" srcSet={imageSrc(b.mobileImageUrl, 800)} />}
          <img src={imageSrc(b.imageUrl, 1400)} alt="" loading="lazy" className="h-full w-full object-cover" />
        </picture>
      )}
      {b.imageUrl && <div className="absolute inset-0 bg-gradient-to-r from-navy-950/80 via-navy-950/40 to-transparent" />}
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex max-w-lg flex-col justify-center">
        {b.isDemo && <DemoBadge className="mb-3 self-start" />}
        <h3 className="text-2xl font-bold sm:text-3xl">{b.title}</h3>
        {b.subtitle && <p className="mt-2 text-sm text-white/85 sm:text-base">{b.subtitle}</p>}
        {b.ctaLabel && b.ctaLink && (
          <Link to={b.ctaLink} className={buttonClass('light', 'sm', 'mt-5 self-start')}>
            {b.ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

function FounderMessage({ data }: { data: NonNullable<HomeData['founderMessage']> }) {
  const reduce = useReducedMotion();
  const paragraphs = (data.message ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return null;
  const initials = (data.name || 'Sakshi Mobile')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-electric-50 via-white to-flame-50 py-16 lg:py-24" aria-labelledby="founder-title">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-violet-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-flame-300/30 blur-3xl" />
      <div className="container relative grid items-center gap-10 lg:grid-cols-[400px_1fr] lg:gap-16">
        {/* Photo */}
        <Reveal className="relative mx-auto w-full max-w-[340px] lg:max-w-none">
          <div className="absolute -inset-3 rotate-3 rounded-[2.5rem] bg-brand-gradient opacity-80 blur-[2px]" />
          <motion.div
            whileHover={reduce ? undefined : { rotate: -1.5, scale: 1.01 }}
            className="relative aspect-[4/5] overflow-hidden rounded-[2.25rem] bg-navy-900 shadow-2xl ring-4 ring-white"
          >
            {data.photoUrl ? (
              <img src={imageSrc(data.photoUrl, 800)} alt={data.name || data.designation || 'Founder'} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <div className="grid-bg flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-navy-900 via-violet-900 to-electric-800 text-white">
                <span className="flex h-28 w-28 items-center justify-center rounded-full bg-white/10 text-4xl font-extrabold ring-2 ring-white/20">
                  {data.name ? initials : <UserRound className="h-14 w-14" />}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-white/60">Photo coming soon</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 via-navy-950/40 to-transparent p-5 pt-16 text-white">
              {data.name && <p className="text-lg font-bold">{data.name}</p>}
              {data.designation && <p className="text-sm text-white/80">{data.designation}</p>}
            </div>
          </motion.div>
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="absolute -right-3 -top-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-xl sm:-right-5"
          >
            <Quote className="h-8 w-8 fill-violet-100" />
          </motion.div>
        </Reveal>

        {/* Message */}
        <Reveal delay={0.1}>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-violet-600">{data.eyebrow || 'Message from our founder'}</p>
          {data.title && (
            <h2 id="founder-title" className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl lg:text-4xl">
              {data.title}
            </h2>
          )}
          <div className="relative mt-6 space-y-4 border-l-4 pl-5 text-base leading-relaxed text-slate-600 sm:text-lg" style={{ borderImage: 'linear-gradient(to bottom, #2563FF, #7C3AED, #FF7A18) 1' }}>
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>
          {(data.name || data.designation) && (
            <div className="mt-7 flex items-center gap-4">
              <span className="h-px w-10 bg-gradient-to-r from-violet-500 to-flame-500" />
              <div>
                {data.name && <p className="font-['Brush_Script_MT',cursive] text-2xl text-navy-900">{data.name}</p>}
                {data.designation && <p className="text-sm font-medium text-slate-500">{data.designation}</p>}
              </div>
            </div>
          )}
          {data.highlights && data.highlights.length > 0 && (
            <ul className="mt-7 flex flex-wrap gap-2.5">
              {data.highlights.filter((h) => h.label).map((h) => (
                <li key={h.label} className="chip bg-white px-4 py-2 text-sm text-navy-800 shadow-sm ring-1 ring-slate-200">
                  <BadgeCheck className="h-4 w-4 text-emerald-500" /> {h.label}
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['public', 'home'], queryFn: () => get<HomeData>('/public/home') });
  const { data: site } = useSite();
  const contact = site?.cms.contact;
  const branchName = data?.branches[0]?.name ?? site?.general.siteName ?? 'Sakshi Mobile';

  return (
    <>
      <Seo
        description="Explore the latest smartphones and accessories at Sakshi Mobile, Omerga."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'MobilePhoneStore',
          name: site?.general.siteName ?? 'Sakshi Mobile',
          url: typeof window !== 'undefined' ? window.location.origin : undefined,
          address: { '@type': 'PostalAddress', addressLocality: 'Omerga', addressRegion: 'Maharashtra', addressCountry: 'IN' },
          ...(site?.general.defaultPhone ? { telephone: site.general.defaultPhone } : {}),
        }}
      />
      <Hero data={data} />

      {error && (
        <div className="container py-10">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      )}

      {/* Hero / spotlight banners managed in CMS */}
      {data && data.heroBanners.length > 0 && (
        <section className="container -mt-8 relative z-10">
          <Swiper modules={[Autoplay, SwiperPagination, A11y]} autoplay={{ delay: 5000, disableOnInteraction: false }} pagination={{ clickable: true }} spaceBetween={16} className="!pb-10">
            {data.heroBanners.map((b) => (
              <SwiperSlide key={b.id}>
                <BannerSlide b={b} />
              </SwiperSlide>
            ))}
          </Swiper>
        </section>
      )}

      {/* D. Shop by brand */}
      <section className="container py-16 lg:py-20">
        <SectionHeading eyebrow="Shop by brand" title="Top brands, one store" text="Tap a brand to explore its phones and accessories." action={<LinkButton to="/brands" variant="outline" size="sm">All brands <ArrowRight className="h-4 w-4" /></LinkButton>} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {(data?.brands ?? Array.from({ length: 8 })).map((b, i) =>
            b ? (
              <Reveal key={b.id} delay={i * 0.04}>
                <Link
                  to={`/brands/${b.slug}`}
                  className="group relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-card transition hover:-translate-y-1.5 hover:shadow-card-hover"
                  style={{ ['--accent' as string]: b.accentColor ?? '#2563FF' }}
                >
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--accent),transparent_70%)] opacity-0 transition duration-500 group-hover:opacity-20" />
                  {b.logoUrl ? (
                    <img src={imageSrc(b.logoUrl, 200)} alt={b.name} loading="lazy" className="relative h-12 w-12 object-contain transition group-hover:scale-110" />
                  ) : (
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-extrabold text-white shadow-lg transition group-hover:scale-110 group-hover:rotate-6" style={{ background: 'linear-gradient(135deg, var(--accent), #7C3AED)' }}>
                      {b.name[0]}
                    </span>
                  )}
                  <span className="relative text-sm font-semibold text-navy-900">{b.name}</span>
                </Link>
              </Reveal>
            ) : (
              <div key={i} className="aspect-square animate-pulse rounded-3xl bg-slate-200/60" />
            ),
          )}
        </div>
      </section>

      {/* Founder & owner message (Website CMS → Founder & Owner Message) */}
      {data?.founderMessage && data.founderMessage.enabled !== false && <FounderMessage data={data.founderMessage} />}

      {/* E. Featured mobiles */}
      <section className="bg-gradient-to-b from-white to-slate-50 py-16 lg:py-20">
        <div className="container">
          <SectionHeading
            eyebrow="Featured"
            title={<>Handpicked <span className="text-gradient-dark">smartphones</span></>}
            text="Popular choices our customers love."
            action={
              <div className="flex items-center gap-2">
                <button className="feat-prev flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white transition hover:border-electric-500 hover:text-electric-600" aria-label="Previous">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button className="feat-next flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white transition hover:border-electric-500 hover:text-electric-600" aria-label="Next">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <LinkButton to="/mobiles" variant="outline" size="sm" className="ml-1">View all</LinkButton>
              </div>
            }
          />
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
          ) : (
            <Swiper
              modules={[Navigation, A11y]}
              navigation={{ prevEl: '.feat-prev', nextEl: '.feat-next' }}
              spaceBetween={16}
              slidesPerView={1.25}
              breakpoints={{ 480: { slidesPerView: 2 }, 900: { slidesPerView: 3 }, 1200: { slidesPerView: 4 } }}
              className="!px-1 !py-3"
            >
              {(data?.featured.length ? data.featured : (data?.latest ?? [])).map((p, i) => (
                <SwiperSlide key={p.id} className="!h-auto">
                  <ProductCard product={p} index={i} />
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </div>
      </section>

      {/* Promo banners */}
      {data && data.promoBanners.length > 0 && (
        <section className="container grid gap-4 py-6 md:grid-cols-2">
          {data.promoBanners.slice(0, 2).map((b, i) => (
            <Reveal key={b.id} delay={i * 0.1}>
              <BannerSlide b={b} />
            </Reveal>
          ))}
        </section>
      )}

      {/* F. Latest offers */}
      {data && data.offers.length > 0 && (
        <section className="container py-16 lg:py-20">
          <SectionHeading eyebrow="Latest offers" title="Deals worth a visit" action={<LinkButton to="/offers" variant="outline" size="sm">All offers <ArrowRight className="h-4 w-4" /></LinkButton>} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.offers.slice(0, 3).map((o, i) => (
              <OfferCard key={o.id} offer={o} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* G. Accessories */}
      {data && data.accessories.length > 0 && (
        <section className="bg-gradient-to-br from-violet-50 via-white to-flame-50 py-16 lg:py-20">
          <div className="container">
            <SectionHeading eyebrow="Accessories" title="Complete your setup" text="Chargers, earbuds, covers, power banks & more." action={<LinkButton to="/accessories" variant="outline" size="sm">Shop accessories <ArrowRight className="h-4 w-4" /></LinkButton>} />
            <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
              {site?.categories
                .filter((c) => c.type === 'ACCESSORY')
                .map((c) => (
                  <Link key={c.id} to={`/accessories?category=${c.slug}`} className="chip shrink-0 bg-white px-4 py-2 text-sm text-navy-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-navy-900 hover:text-white">
                    <DynamicIcon name={c.icon} className="h-4 w-4" /> {c.name}
                  </Link>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {data.accessories.slice(0, 4).map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* H. Branches */}
      {data && data.branches.length > 0 && (
        <section className="container py-16 lg:py-20">
          <SectionHeading eyebrow="Visit us" title="Our branches" text="Drop by for hands-on demos and expert advice." action={<LinkButton to="/branches" variant="outline" size="sm">All branches <ArrowRight className="h-4 w-4" /></LinkButton>} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.branches.map((b, i) => (
              <BranchCard key={b.id} branch={b} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* I. Why choose us */}
      {data?.whyChoose?.items && (
        <section className="relative overflow-hidden bg-navy-950 py-16 text-white lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-hero-gradient opacity-60" />
          <div className="container relative">
            <SectionHeading dark center eyebrow="Why Sakshi Mobile" title={data.whyChoose.title ?? 'Why choose us?'} text={data.whyChoose.subtitle} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.whyChoose.items.map((it, i) => (
                <Reveal key={it.title} delay={i * 0.06}>
                  <div className="glass group h-full rounded-3xl p-6 transition hover:-translate-y-1 hover:bg-white/10">
                    <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500 via-violet-500 to-flame-500 shadow-glow transition group-hover:rotate-6 group-hover:scale-110">
                      <DynamicIcon name={it.icon} className="h-6 w-6" />
                    </span>
                    <h3 className="text-lg font-semibold">{it.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-300">{it.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* J. Reviews */}
      {data && data.testimonials.length > 0 && (
        <section className="container py-16 lg:py-20">
          <SectionHeading center eyebrow="Customer reviews" title="What customers say" />
          <Swiper
            modules={[Autoplay, SwiperPagination, A11y]}
            autoplay={{ delay: 5500, disableOnInteraction: false, pauseOnMouseEnter: true }}
            pagination={{ clickable: true }}
            spaceBetween={20}
            slidesPerView={1}
            breakpoints={{ 768: { slidesPerView: 2 }, 1100: { slidesPerView: 3 } }}
            className="!pb-12"
          >
            {data.testimonials.map((t) => (
              <SwiperSlide key={t.id} className="!h-auto">
                <figure className="card relative flex h-full flex-col p-6">
                  <Quote className="absolute right-5 top-5 h-10 w-10 text-violet-100" />
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={cn('h-4 w-4', i < t.rating ? 'fill-flame-400 text-flame-400' : 'text-slate-200')} />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-slate-600">“{t.message}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    {t.avatarUrl ? (
                      <img src={imageSrc(t.avatarUrl, 96)} alt="" className="h-11 w-11 rounded-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-electric-500 to-violet-500 font-bold text-white">{t.customerName[0]}</span>
                    )}
                    <span>
                      <span className="block font-semibold text-navy-900">{t.customerName}</span>
                      <span className="text-xs text-slate-500">{t.location}</span>
                    </span>
                    {t.isDemo && <DemoBadge className="ml-auto" label="Sample" />}
                  </figcaption>
                </figure>
              </SwiperSlide>
            ))}
          </Swiper>
        </section>
      )}

      {/* K. Contact */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-violet-950 py-16 text-white lg:py-24">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
        <div className="container relative grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <SectionHeading dark eyebrow="Contact" title={contact?.heading ?? 'We’d love to help you'} text="Send an inquiry about a phone, exchange or EMI — our team will call you back." />
            <ul className="space-y-4 text-slate-300">
              {contact?.address && (
                <li className="flex gap-3">
                  <MapPin className="h-5 w-5 shrink-0 text-flame-400" /> {contact.address}
                </li>
              )}
              {(contact?.phone || site?.general.defaultPhone) && (
                <li>
                  <a className="flex gap-3 hover:text-white" href={telHref(contact?.phone || site!.general.defaultPhone)}>
                    <Phone className="h-5 w-5 text-flame-400" /> {contact?.phone || site?.general.defaultPhone}
                  </a>
                </li>
              )}
              {(contact?.email || site?.general.email) && (
                <li>
                  <a className="flex gap-3 hover:text-white" href={`mailto:${contact?.email || site?.general.email}`}>
                    <Mail className="h-5 w-5 text-flame-400" /> {contact?.email || site?.general.email}
                  </a>
                </li>
              )}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <WhatsAppButton context={{ kind: 'exchange' }} variant="light">Exchange inquiry</WhatsAppButton>
              <WhatsAppButton context={{ kind: 'emi' }} variant="light">EMI inquiry</WhatsAppButton>
            </div>
            <p className="mt-6 text-xs text-slate-500">Visiting {branchName}? Check timings on the branch page.</p>
          </Reveal>
          <Reveal delay={0.1} className="glass rounded-3xl p-6 sm:p-8">
            <InquiryForm dark />
          </Reveal>
        </div>
      </section>
    </>
  );
}
