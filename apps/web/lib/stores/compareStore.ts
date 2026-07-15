"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CompareEntry {
  productId: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  imageUrl: string | null;
}

interface CompareState {
  entries: CompareEntry[];
  toggle: (entry: CompareEntry) => void;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}

const MAX_COMPARE_ITEMS = 4;

/** SHOPPING FEATURES — product comparison: client-only (Zustand), ephemeral browsing state, same pattern as cartStore/wishlistStore before accounts existed — never persisted server-side. */
export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      entries: [],
      toggle: (entry) => {
        set((state) => {
          if (state.entries.some((e) => e.productId === entry.productId)) {
            return { entries: state.entries.filter((e) => e.productId !== entry.productId) };
          }
          if (state.entries.length >= MAX_COMPARE_ITEMS) {
            return state;
          }
          return { entries: [...state.entries, entry] };
        });
      },
      remove: (productId) => {
        set((state) => ({ entries: state.entries.filter((e) => e.productId !== productId) }));
      },
      has: (productId) => get().entries.some((e) => e.productId === productId),
      clear: () => {
        set({ entries: [] });
      },
    }),
    { name: "silonya-compare" },
  ),
);

export { MAX_COMPARE_ITEMS };
