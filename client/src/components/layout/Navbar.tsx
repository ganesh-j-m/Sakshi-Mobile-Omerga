import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { WhatsAppButton } from '../WhatsAppButton';
import { Logo } from './Logo';
import { SearchDialog } from './SearchDialog';

export const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/mobiles', label: 'Mobiles' },
  { to: '/accessories', label: 'Accessories' },
  { to: '/brands', label: 'Brands' },
  { to: '/offers', label: 'Offers' },
  { to: '/branches', label: 'Branches' },
  { to: '/contact', label: 'Contact' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 transition-all duration-300',
          scrolled ? 'bg-navy-950/85 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl' : 'bg-navy-950',
        )}
      >
        <nav className="container flex h-16 items-center justify-between gap-4 lg:h-[72px]" aria-label="Main">
          <Logo />
          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    cn(
                      'relative rounded-lg px-3.5 py-2 text-sm font-medium transition',
                      isActive ? 'text-white' : 'text-slate-300 hover:text-white',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {l.label}
                      {isActive && (
                        <motion.span
                          layoutId="nav-pill"
                          className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-electric-400 via-violet-400 to-flame-400"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSearch(true)}
              className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Search products"
            >
              <Search className="h-4 w-4" />
              <span className="hidden xl:inline">Search</span>
              <kbd className="hidden rounded bg-white/10 px-1.5 text-[10px] xl:inline">Ctrl K</kbd>
            </button>
            <WhatsAppButton size="sm" className="hidden sm:inline-flex" context={{ kind: 'general' }} />
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white lg:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-white/10 bg-navy-950 lg:hidden"
            >
              <motion.ul
                className="container flex flex-col gap-1 py-4"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
              >
                {NAV_LINKS.map((l) => (
                  <motion.li key={l.to} variants={{ hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0 } }}>
                    <NavLink
                      to={l.to}
                      end={l.end}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-xl px-4 py-3 text-base font-medium',
                          isActive ? 'bg-gradient-to-r from-electric-500/20 to-violet-500/20 text-white' : 'text-slate-300 hover:bg-white/5',
                        )
                      }
                    >
                      {l.label}
                    </NavLink>
                  </motion.li>
                ))}
                <motion.li variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="pt-2">
                  <WhatsAppButton className="w-full" context={{ kind: 'general' }}>
                    Chat on WhatsApp
                  </WhatsAppButton>
                </motion.li>
              </motion.ul>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <SearchDialog open={search} onClose={() => setSearch(false)} />
    </>
  );
}
