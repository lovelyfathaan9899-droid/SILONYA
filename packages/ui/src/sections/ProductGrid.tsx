import type { ReactNode } from "react";
import { Grid } from "../layout/Grid";
import { ProductCard, type ProductCardProps } from "../patterns/ProductCard";

export interface ProductGridItem extends Omit<
  ProductCardProps,
  "isWishlisted" | "onWishlistToggle"
> {
  id: string;
}

export interface ProductGridProps {
  products: ProductGridItem[];
  wishlistedIds?: string[];
  onWishlistToggle?: (id: string) => void;
  emptyState?: ReactNode;
}

/** Responsive PLP/homepage grid — 2-up mobile, 4-up desktop (DESIGN_SYSTEM.md §2.3's 4/12-col system). */
export function ProductGrid({
  products,
  wishlistedIds,
  onWishlistToggle,
  emptyState,
}: ProductGridProps) {
  if (products.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <Grid>
      {products.map((product) => (
        <div key={product.id} className="col-span-2 lg:col-span-3">
          <ProductCard
            {...product}
            isWishlisted={wishlistedIds?.includes(product.id) ?? false}
            {...(onWishlistToggle
              ? {
                  onWishlistToggle: () => {
                    onWishlistToggle(product.id);
                  },
                }
              : {})}
          />
        </div>
      ))}
    </Grid>
  );
}
