'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartLine {
  key: string;
  mealId: string;
  mealName: string;
  slug: string;
  unitPrice: number; // display only — the server reprices at checkout
  quantity: number;
  removed: { id: string; name: string }[];
  addons: { id: string; name: string }[];
  note: string;
}

interface CartApi {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  removeMeals: (mealIds: string[]) => void;
  clear: () => void;
}

const STORAGE_KEY = 'fana-cart-v1';
const CartContext = createContext<CartApi | null>(null);

const lineKey = (l: Omit<CartLine, 'key'>) =>
  [l.mealId, l.removed.map((r) => r.id).sort().join(), l.addons.map((a) => a.id).sort().join(), l.note].join('|');

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLines(JSON.parse(saved));
    } catch { /* unreadable cart → start empty */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, loaded]);

  const add = useCallback((line: Omit<CartLine, 'key'>) => {
    const key = lineKey(line);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (!existing) return [...prev, { ...line, key }];
      return prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l));
    });
  }, []);

  const api = useMemo<CartApi>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    add,
    setQuantity: (key, quantity) =>
      setLines((p) => p.flatMap((l) => (l.key !== key ? [l] : quantity < 1 ? [] : [{ ...l, quantity: Math.min(20, quantity) }]))),
    remove: (key) => setLines((p) => p.filter((l) => l.key !== key)),
    removeMeals: (mealIds) => setLines((p) => p.filter((l) => !mealIds.includes(l.mealId))),
    clear: () => setLines([]),
  }), [lines, add]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
