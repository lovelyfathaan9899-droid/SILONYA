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
  discountCode: string | null;
  open: () => void;
  close: () => void;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  removeLine: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  setDiscountCode: (code: string | null) => void;
  clear: () => void;
}

/**
 * Client-only pre-checkout cart state (TECH_STACK.md §2 — "Zustand... for
 * cart/UI state only"). This is the browsing-time cart; at checkout,
 * `checkout.createIntent` (packages/api) re-validates every line against
 * live data and creates the durable Postgres Cart/Order rows
 * (DATABASE_ARCHITECTURE.md §3.4) — nothing here is trusted server-side,
 * only used to build that request. `clear()` is called once an order is
 * successfully placed.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      discountCode: null,
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
      setDiscountCode: (code) => {
        set({ discountCode: code });
      },
      clear: () => {
        set({ lines: [], discountCode: null, isOpen: false });
      },
    }),
    { name: "silonya-cart" },
  ),
);

export function useCartCount(): number {
  return useCartStore((state) => state.lines.reduce((sum, line) => sum + line.quantity, 0));
}
