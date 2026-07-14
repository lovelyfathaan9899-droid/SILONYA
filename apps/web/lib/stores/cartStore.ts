"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLine {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  unitPrice: number;
  currency: string;
  imageUrl: string | null;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  removeLine: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
}

/**
 * Client-only cart state (TECH_STACK.md §2 — "Zustand... for cart/UI state
 * only"). No server persistence yet: there is no real checkout in this
 * phase (explicitly out of scope), so nothing here needs to survive past
 * the browser — CartItem/Cart in DATABASE_ARCHITECTURE.md §3.4 are wired up
 * when checkout is actually built, at which point this store starts
 * syncing to `cart.addItem` etc. (API_SPECIFICATION.md §2) instead of only
 * writing to localStorage.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      open: () => {
        set({ isOpen: true });
      },
      close: () => {
        set({ isOpen: false });
      },
      addLine: (line, quantity = 1) => {
        set((state) => {
          const existing = state.lines.find((l) => l.variantId === line.variantId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.variantId === line.variantId ? { ...l, quantity: l.quantity + quantity } : l,
              ),
              isOpen: true,
            };
          }
          return { lines: [...state.lines, { ...line, quantity }], isOpen: true };
        });
      },
      removeLine: (variantId) => {
        set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) }));
      },
      setQuantity: (variantId, quantity) => {
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.variantId !== variantId)
              : state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)),
        }));
      },
    }),
    { name: "silonya-cart" },
  ),
);

export function useCartCount(): number {
  return useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));
}
