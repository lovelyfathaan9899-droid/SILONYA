"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  productIds: string[];
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
}

/**
 * Product-level (not variant-level) local wishlist — matches how a
 * WishlistButton appears on a ProductCard, before a variant is chosen.
 * DATABASE_ARCHITECTURE.md §3.7's `WishlistItem` is variant-level and tied
 * to a `User`; reconciling local/anonymous wishlist state with that table
 * happens once customer accounts exist (out of scope for this
 * storefront-UI phase, same reasoning as cartStore.ts).
 */
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      toggle: (productId) => {
        set((state) =>
          state.productIds.includes(productId)
            ? { productIds: state.productIds.filter((id) => id !== productId) }
            : { productIds: [...state.productIds, productId] },
        );
      },
      has: (productId) => get().productIds.includes(productId),
    }),
    { name: "silonya-wishlist" },
  ),
);
