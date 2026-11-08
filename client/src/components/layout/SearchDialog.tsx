import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { get } from '@/lib/api';
import { effectivePrice, inr } from '@/lib/format';
import type { Paginated, ProductSummary } from '@/types';
import { ProductMedia } from '../ProductMedia';
import { Spinner } from '../ui';

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const q = useDebounced(term.trim());
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => get<Paginated<ProductSummary>>('/public/products', { search: q, limit: 6 }),
    enabled: open && q.length >= 2,
  });

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = () => {
    if (!q) return;
    onClose();
    navigate(`/mobiles?search=${encodeURIComponent(q)}`);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] bg-navy-950/70 p-4 pt-[10vh] backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: -20, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            role="dialog"
            aria-label="Search products"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex items-center gap-3 border-b border-slate-100 px-5"
            >
              <Search className="h-5 w-5 text-violet-500" />
              <input
                ref={input}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search phones, brands, accessories…"
                className="h-16 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
                aria-label="Search"
              />
              {isFetching && <Spinner className="h-5 w-5" />}
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close search">
                <X className="h-5 w-5" />
              </button>
            </form>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {q.length < 2 && <p className="px-4 py-6 text-center text-sm text-slate-400">Type at least 2 characters to search</p>}
              {q.length >= 2 && data?.items.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No products found for “{q}”.</p>
              )}
              {data?.items.map((p) => (
                <Link
                  key={p.id}
                  to={`/${p.category.type === 'ACCESSORY' ? 'accessories' : 'mobiles'}/${p.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-4 rounded-2xl p-3 transition hover:bg-slate-50"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-1">
                    <ProductMedia url={p.images[0]?.url} alt={p.name} type={p.category.type} categorySlug={p.category.slug} color={p.colors[0]?.hex} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-navy-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.brand.name} · {p.category.name}</p>
                  </div>
                  <span className="font-semibold text-navy-900">{inr(effectivePrice(p))}</span>
                </Link>
              ))}
              {data && data.pagination.total > data.items.length && (
                <button onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-2xl p-3 text-sm font-semibold text-electric-600 hover:bg-electric-50">
                  See all {data.pagination.total} results <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
