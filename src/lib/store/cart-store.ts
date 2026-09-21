"use client";
// ── Cart store (Zustand + localStorage persist) ──
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLine {
  id: string;
  qty: number;
  addedAt: number;
}

interface CartState {
  lines: CartLine[];
  add: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (id, qty = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.id === id);
          if (existing) {
            return {
              lines: s.lines.map((l) => (l.id === id ? { ...l, qty: Math.min(99, l.qty + qty) } : l)),
            };
          }
          return { lines: [...s.lines, { id, qty, addedAt: Date.now() }] };
        }),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      setQty: (id, qty) =>
        set((s) => ({
          lines:
            qty <= 0
              ? s.lines.filter((l) => l.id !== id)
              : s.lines.map((l) => (l.id === id ? { ...l, qty: Math.min(99, qty) } : l)),
        })),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((acc, l) => acc + l.qty, 0),
    }),
    { name: "yassaei.cart", skipHydration: true },
  ),
);

interface CompareState {
  ids: string[];
  toggle: (id: string) => void;
  clear: () => void;
}

export const useCompare = create<CompareState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id].slice(-4),
        })),
      clear: () => set({ ids: [] }),
    }),
    { name: "yassaei.compare", skipHydration: true },
  ),
);

interface RecentlyViewedState {
  ids: string[];
  push: (id: string) => void;
}

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      ids: [],
      push: (id) =>
        set((s) => ({ ids: [id, ...s.ids.filter((x) => x !== id)].slice(0, 8) })),
    }),
    { name: "yassaei.recent", skipHydration: true },
  ),
);
