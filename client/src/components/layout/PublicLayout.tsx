import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, GitCompareArrows, MessageCircle, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useCompare } from '@/context/compare';
import { useDefaultWhatsapp, useSite } from '@/hooks/useSite';
import { whatsappLink, whatsappMessage } from '@/lib/whatsapp';
import { PageTransition } from '../motion';
import { buttonClass, PageLoader } from '../ui';
import { AnnouncementBar } from './AnnouncementBar';
import { Footer } from './Footer';
import { Navbar } from './Navbar';

function CompareTray() {
  const { items, remove, clear } = useCompare();
  const { pathname } = useLocation();
  if (!items.length || pathname === '/compare') return null;
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-4 left-1/2 z-40 w-[min(94vw,720px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-navy-900/95 p-3 text-white shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center gap-3">
        <GitCompareArrows className="hidden h-5 w-5 shrink-0 text-violet-400 sm:block" />
        <div className="scrollbar-none flex flex-1 gap-2 overflow-x-auto">
          {items.map((i) => (
            <span key={i.slug} className="chip shrink-0 bg-white/10 py-1.5 text-white">
              <span className="max-w-[140px] truncate">{i.name}</span>
              <button onClick={() => remove(i.slug)} aria-label={`Remove ${i.name}`} className="text-slate-400 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <button onClick={clear} className="hidden text-xs text-slate-400 hover:text-white sm:block">
          Clear
        </button>
        <Link to="/compare" className={buttonClass('primary', 'sm')}>
          Compare ({items.length})
        </Link>
      </div>
    </motion.div>
  );
}

function FloatingActions() {
  const [showTop, setShowTop] = useState(false);
  const number = useDefaultWhatsapp();
  const { data } = useSite();
  const wa = whatsappLink(number, whatsappMessage({ kind: 'general' }, data?.general.siteName));
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6">
      <AnimatePresence>
        {showTop && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => window.scrollTo({ top: 0 })}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-navy-900 shadow-xl ring-1 ring-slate-200"
            aria-label="Back to top"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,0.8)] transition hover:scale-110"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/40 motion-reduce:hidden" />
          <MessageCircle className="relative h-7 w-7" />
        </a>
      )}
    </div>
  );
}

export function PublicLayout() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <AnnouncementBar />
      <Navbar />
      <main id="main" className="flex-1">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </PageTransition>
        </AnimatePresence>
      </main>
      <Footer />
      <CompareTray />
      <FloatingActions />
    </div>
  );
}
