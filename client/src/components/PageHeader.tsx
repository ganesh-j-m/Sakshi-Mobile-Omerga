import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PageHeader({
  eyebrow,
  title,
  text,
  crumbs = [],
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  text?: ReactNode;
  crumbs?: { to?: string; label: string }[];
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-navy-950 py-12 text-white sm:py-16">
      <div className="animated-gradient pointer-events-none absolute inset-0 bg-hero-gradient" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="container relative">
        {crumbs.length > 0 && (
          <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-400" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-white">Home</Link>
            {crumbs.map((c) => (
              <span key={c.label} className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5" />
                {c.to ? <Link to={c.to} className="hover:text-white">{c.label}</Link> : <span className="text-slate-200">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-flame-300">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
        {text && <div className="mt-3 max-w-2xl text-slate-300">{text}</div>}
        {children}
      </div>
    </section>
  );
}
