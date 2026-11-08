import { motion, useReducedMotion } from 'framer-motion';
import { GitCompareArrows, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompare } from '@/context/compare';
import { useSite } from '@/hooks/useSite';
import { cn } from '@/lib/cn';
import { discountPct, effectivePrice, gb, inr } from '@/lib/format';
import type { ProductSummary } from '@/types';
import { ProductMedia } from './ProductMedia';
import { DemoBadge, StockBadge } from './ui';
import { useToast } from './ui/toast';

export function ProductCard({ product, index = 0 }: { product: ProductSummary; index?: number }) {
  const reduce = useReducedMotion();
  const compare = useCompare();
  const { notify } = useToast();
  const { data: site } = useSite();
  const [color, setColor] = useState(product.colors[0]);
  const off = discountPct(product);
  const href = `/${product.category.type === 'ACCESSORY' ? 'accessories' : 'mobiles'}/${product.slug}`;
  const inCompare = compare.has(product.slug);
  const image = product.images[0]?.url;
  const hoverImage = product.images[1]?.url;

  const onCompare = () => {
    const r = compare.toggle({ slug: product.slug, name: product.name });
    if (r === 'full') notify(`You can compare up to ${compare.max} products`, 'info');
    else notify(r === 'added' ? `${product.name} added to compare` : 'Removed from compare', 'info');
  };

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.05 }}
      whileHover={reduce ? undefined : { y: -6 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-card transition-shadow duration-300 hover:shadow-card-hover"
    >
      <div className="absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
        {off > 0 && <span className="chip bg-gradient-to-r from-flame-500 to-rose-500 text-white shadow-glow-flame">{off}% OFF</span>}
        {product.isFeatured && (
          <span className="chip bg-navy-900 text-white">
            <Sparkles className="h-3 w-3 text-flame-400" /> Featured
          </span>
        )}
        {product.isDemo && site?.general.showDemoBadge !== false && <DemoBadge label="Demo" />}
      </div>
      <button
        onClick={onCompare}
        aria-pressed={inCompare}
        title={inCompare ? 'Remove from compare' : 'Add to compare'}
        className={cn(
          'absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition',
          inCompare ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-200 bg-white/80 text-slate-600 hover:border-violet-400 hover:text-violet-600',
        )}
      >
        <GitCompareArrows className="h-4 w-4" />
      </button>

      <Link to={href} className="relative block overflow-hidden bg-gradient-to-br from-slate-50 via-electric-50/40 to-violet-50/60 px-6 pb-4 pt-10">
        <div className="absolute inset-x-10 bottom-4 h-10 rounded-full bg-violet-500/20 blur-2xl transition group-hover:bg-electric-500/30" />
        <div className="relative mx-auto flex h-48 items-center justify-center transition duration-500 group-hover:scale-105 sm:h-56">
          <ProductMedia
            url={image}
            alt={product.name}
            type={product.category.type}
            categorySlug={product.category.slug}
            color={color?.hex}
            className={cn(hoverImage && 'transition-opacity duration-500 group-hover:opacity-0')}
          />
          {hoverImage && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <ProductMedia url={hoverImage} alt={product.name} type={product.category.type} />
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <Link to={`/brands/${product.brand.slug}`} className="text-xs font-semibold uppercase tracking-wider text-violet-600 hover:underline">
            {product.brand.name}
          </Link>
          <StockBadge status={product.stockStatus} />
        </div>
        <Link to={href} className="line-clamp-2 font-semibold leading-snug text-navy-900 transition hover:text-electric-600">
          {product.name}
        </Link>
        {(product.ramGb || product.storageGb) && (
          <p className="text-xs text-slate-500">{[gb(product.ramGb) && `${gb(product.ramGb)} RAM`, gb(product.storageGb)].filter(Boolean).join(' · ')}</p>
        )}
        {product.colors.length > 0 && (
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Colours">
            {product.colors.slice(0, 5).map((c) => (
              <button
                key={c.name}
                role="radio"
                aria-checked={color?.name === c.name}
                title={c.name}
                onClick={() => setColor(c)}
                className={cn(
                  'h-5 w-5 rounded-full border-2 transition',
                  color?.name === c.name ? 'scale-110 border-electric-500 ring-2 ring-electric-200' : 'border-white ring-1 ring-slate-200',
                )}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        )}
        <div className="mt-auto flex items-end gap-2 pt-2">
          <span className="text-xl font-bold text-navy-900">{inr(effectivePrice(product))}</span>
          {product.mrp > effectivePrice(product) && <span className="pb-0.5 text-sm text-slate-400 line-through">{inr(product.mrp)}</span>}
        </div>
      </div>
    </motion.article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white">
      <div className="h-60 animate-pulse bg-slate-100 sm:h-72" />
      <div className="space-y-2 p-5">
        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}
