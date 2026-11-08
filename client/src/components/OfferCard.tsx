import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, CreditCard, Gift, Percent, RefreshCw, Sparkles, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { imageSrc } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateFmt, OFFER_TYPE_LABEL } from '@/lib/format';
import type { Offer } from '@/types';
import { DemoBadge } from './ui';
import { WhatsAppButton } from './WhatsAppButton';

const THEME: Record<Offer['offerType'], { grad: string; Icon: typeof Tag }> = {
  DISCOUNT: { grad: 'from-electric-500 via-electric-600 to-violet-600', Icon: Percent },
  CASHBACK: { grad: 'from-emerald-500 to-teal-600', Icon: Gift },
  EXCHANGE: { grad: 'from-violet-500 via-fuchsia-500 to-flame-500', Icon: RefreshCw },
  EMI: { grad: 'from-navy-700 via-electric-700 to-electric-500', Icon: CreditCard },
  BUNDLE: { grad: 'from-flame-500 via-rose-500 to-violet-600', Icon: Sparkles },
  FESTIVAL: { grad: 'from-amber-400 via-flame-500 to-rose-600', Icon: Sparkles },
};

export function OfferCard({ offer, index = 0, whatsapp }: { offer: Offer; index?: number; whatsapp?: string | null }) {
  const reduce = useReducedMotion();
  const t = THEME[offer.offerType];
  const value =
    offer.discountType === 'PERCENT' && offer.discountValue
      ? `${offer.discountValue}% OFF`
      : offer.discountType === 'FLAT' && offer.discountValue
        ? `₹${offer.discountValue.toLocaleString('en-IN')} OFF`
        : offer.badge || OFFER_TYPE_LABEL[offer.offerType];

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07, duration: 0.5 }}
      whileHover={reduce ? undefined : { y: -6, rotate: -0.3 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-slate-200/70 transition-shadow hover:shadow-card-hover"
    >
      <div className={cn('relative overflow-hidden bg-gradient-to-br p-6 text-white', t.grad)}>
        {offer.bannerUrl && <img src={imageSrc(offer.bannerUrl, 800)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-overlay" />}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-xl transition group-hover:scale-125" />
        <t.Icon className="absolute -bottom-4 right-4 h-24 w-24 text-white/15 transition duration-500 group-hover:rotate-12" />
        <div className="relative flex items-center gap-2">
          <span className="chip bg-white/20 text-white backdrop-blur">{OFFER_TYPE_LABEL[offer.offerType]}</span>
          {offer.isDemo && <DemoBadge label="Demo" />}
        </div>
        <p className="relative mt-4 text-3xl font-extrabold tracking-tight">{value}</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-semibold leading-snug text-navy-900">{offer.title}</h3>
        {offer.description && <p className="line-clamp-3 text-sm text-slate-500">{offer.description}</p>}
        <div className="flex flex-wrap gap-2 text-xs">
          {offer.brand && (
            <Link to={`/brands/${offer.brand.slug}`} className="chip bg-violet-50 text-violet-700 hover:bg-violet-100">
              <Tag className="h-3 w-3" /> {offer.brand.name}
            </Link>
          )}
          {offer.product && (
            <Link to={`/mobiles/${offer.product.slug}`} className="chip bg-electric-50 text-electric-700 hover:bg-electric-100">
              {offer.product.name}
            </Link>
          )}
          {offer.branches.map((b) => (
            <Link key={b.id} to={`/branches/${b.slug}`} className="chip bg-slate-100 text-slate-600 hover:bg-slate-200">
              {b.name}
            </Link>
          ))}
        </div>
        {offer.validTo && (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock className="h-3.5 w-3.5" /> Valid till {dateFmt(offer.validTo)}
          </p>
        )}
        {offer.terms && (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer font-medium text-slate-600">Terms</summary>
            <p className="mt-1 whitespace-pre-line">{offer.terms}</p>
          </details>
        )}
        <WhatsAppButton
          size="sm"
          className="mt-auto"
          number={whatsapp}
          context={{ kind: 'offer', offer, branchName: offer.branches[0]?.name }}
        >
          Ask about this offer
        </WhatsAppButton>
      </div>
    </motion.article>
  );
}
