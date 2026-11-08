import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function Logo({ dark = true, className, to = '/' }: { dark?: boolean; className?: string; to?: string }) {
  return (
    <Link to={to} className={cn('group flex items-center gap-2.5', className)} aria-label="Sakshi Mobile — home">
      <span className="animated-gradient relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient shadow-glow transition group-hover:rotate-6">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <rect x="6" y="2.5" width="12" height="19" rx="3" />
          <path d="M14.5 8.2c-.7-.6-1.5-.9-2.3-.9-1.2 0-2 .6-2 1.5 0 2.1 4.4 1.3 4.4 3.8 0 1-.9 1.7-2.3 1.7-1 0-1.8-.3-2.5-1" />
        </svg>
      </span>
      <span className="leading-none">
        <span className={cn('block text-lg font-extrabold tracking-tight', dark ? 'text-white' : 'text-navy-900')}>
          Sakshi <span className="text-gradient">Mobile</span>
        </span>
        <span className={cn('block text-[10px] font-medium uppercase tracking-[0.25em]', dark ? 'text-slate-400' : 'text-slate-500')}>
          Omerga
        </span>
      </span>
    </Link>
  );
}
