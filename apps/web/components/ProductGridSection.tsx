"use client";

import { ProductGrid, type ProductGridItem } from "@silonya/ui";
import { useWishlistStore } from "@/lib/stores/wishlistStore";

export interface ProductGridSectionProps {
  products: ProductGridItem[];
  emptyMessage?: string;
}

/**
 * Client island wiring the local wishlist store into the (otherwise fully
 * controlled) ProductGrid — used by every page that renders a product grid
 * (homepage, PLP, PDP related products) so the store subscription lives in
 * exactly one place. ProductGrid/ProductCard stay store-free per
 * PROJECT_RULES.md §1.
 */
export function ProductGridSection({ products }: ProductGridSectionProps) {
  const productIds = useWishlistStore((state) => state.productIds);
  const toggle = useWishlistStore((state) => state.toggle);

  return <ProductGrid products={products} wishlistedIds={productIds} onWishlistToggle={toggle} />;
}
