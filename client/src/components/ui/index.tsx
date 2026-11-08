import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, FlaskConical, Inbox, Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { STOCK_META } from '@/lib/format';
import type { StockStatus } from '@/types';

/* ───────────────────────────── Buttons ───────────────────────────── */

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'whatsapp' | 'danger' | 'light' | 'flame';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-electric-500 to-violet-500 text-white shadow-glow hover:shadow-glow-violet hover:brightness-110',
  flame: 'bg-gradient-to-r from-flame-500 to-rose-500 text-white shadow-glow-flame hover:brightness-110',
  secondary: 'bg-navy-900 text-white hover:bg-navy-800',
  outline: 'border border-slate-300 bg-white text-navy-900 hover:border-electric-500 hover:text-electric-600',
  ghost: 'text-navy-700 hover:bg-slate-100',
  light: 'border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20',
  whatsapp: 'bg-[#25D366] text-white shadow-[0_10px_30px_-10px_rgba(37,211,102,0.7)] hover:bg-[#1fb959]',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 py-3.5 text-base gap-2.5',
};
export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  cn(
    'inline-flex select-none items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  );

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export function LinkButton({ variant = 'primary', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

/* ───────────────────────────── Badges ───────────────────────────── */

export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  const m = STOCK_META[status];
  return (
    <span className={cn('chip', m.className, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}

export function DemoBadge({ className, label = 'Demo data' }: { className?: string; label?: string }) {
  return (
    <span
      title="Sample content — will be replaced with verified business information"
      className={cn('chip bg-amber-100 text-amber-800 ring-1 ring-amber-300', className)}
    >
      <FlaskConical className="h-3 w-3" /> {label}
    </span>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('chip bg-slate-100 text-slate-700', className)}>{children}</span>;
}

/* ───────────────────────────── Feedback ─────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-slate-200/70', className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-6 w-6 animate-spin text-electric-500', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-50 to-violet-100 text-violet-600">
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Something went wrong"
      text={error instanceof Error ? error.message : 'Please try again.'}
      action={onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
    />
  );
}

/* ───────────────────────────── Pagination ─────────────────────────── */

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );
  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Pagination">
      <button className={buttonClass('outline', 'sm')} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
          <button
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'h-9 min-w-9 rounded-xl px-3 text-sm font-semibold transition',
              p === page ? 'bg-gradient-to-r from-electric-500 to-violet-500 text-white shadow-glow' : 'bg-white text-navy-700 hover:bg-slate-100',
            )}
          >
            {p}
          </button>
        </span>
      ))}
      <button className={buttonClass('outline', 'sm')} disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

/* ───────────────────────────── Modal ───────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-navy-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn('flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl', width)}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ───────────────────────────── Section heading ─────────────────────── */

export function SectionHeading({
  eyebrow,
  title,
  text,
  action,
  dark,
  center,
}: {
  eyebrow?: string;
  title: ReactNode;
  text?: string;
  action?: ReactNode;
  dark?: boolean;
  center?: boolean;
}) {
  return (
    <div className={cn('mb-8 flex flex-col gap-4 sm:mb-10', center ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between')}>
      <div className={cn(center && 'max-w-2xl')}>
        {eyebrow && (
          <p className={cn('mb-2 text-xs font-bold uppercase tracking-[0.2em]', dark ? 'text-flame-400' : 'text-violet-600')}>{eyebrow}</p>
        )}
        <h2 className={cn('text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl', dark ? 'text-white' : 'text-navy-900')}>{title}</h2>
        {text && <p className={cn('mt-2 text-sm sm:text-base', dark ? 'text-slate-300' : 'text-slate-500')}>{text}</p>}
      </div>
      {action}
    </div>
  );
}
