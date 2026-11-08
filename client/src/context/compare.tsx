import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type CompareItem = { slug: string; name: string };
const KEY = 'sm_compare';
const MAX = 4;

type Ctx = {
  items: CompareItem[];
  has: (slug: string) => boolean;
  toggle: (item: CompareItem) => 'added' | 'removed' | 'full';
  remove: (slug: string) => void;
  clear: () => void;
  max: number;
};

const CompareContext = createContext<Ctx | null>(null);

function load(): CompareItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CompareItem[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable — keep in memory only */
    }
  }, [items]);

  const value: Ctx = {
    items,
    max: MAX,
    has: (slug) => items.some((i) => i.slug === slug),
    toggle: (item) => {
      if (items.some((i) => i.slug === item.slug)) {
        setItems((x) => x.filter((i) => i.slug !== item.slug));
        return 'removed';
      }
      if (items.length >= MAX) return 'full';
      setItems((x) => [...x, item]);
      return 'added';
    },
    remove: (slug) => setItems((x) => x.filter((i) => i.slug !== slug)),
    clear: () => setItems([]),
  };
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used inside CompareProvider');
  return ctx;
}
