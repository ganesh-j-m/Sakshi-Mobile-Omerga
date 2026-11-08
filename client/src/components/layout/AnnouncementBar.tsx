import { AnimatePresence, motion } from 'framer-motion';
import { Megaphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '@/hooks/useSite';

export function AnnouncementBar() {
  const { data } = useSite();
  const items = data?.cms.announcement?.enabled === false ? [] : (data?.cms.announcement?.items ?? []).filter((i) => i.text);
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length || hidden) return null;
  const item = items[index % items.length];

  return (
    <div className="animated-gradient relative z-50 bg-gradient-to-r from-electric-600 via-violet-600 to-flame-500 text-white">
      <div className="container flex h-9 items-center justify-center gap-2 pr-10 text-xs font-medium sm:text-sm">
        <Megaphone className="h-4 w-4 shrink-0" />
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="truncate"
          >
            {item.link ? (
              <Link to={item.link} className="underline-offset-2 hover:underline">
                {item.text}
              </Link>
            ) : (
              item.text
            )}
          </motion.div>
        </AnimatePresence>
        <button onClick={() => setHidden(true)} className="absolute right-3 rounded p-1 hover:bg-white/15" aria-label="Hide announcement">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
