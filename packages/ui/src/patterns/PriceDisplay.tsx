import { formatPriceForDisplay } from "@silonya/utils";
import { cn } from "../lib/cn";

export interface PriceDisplayProps {
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  className?: string;
}

/** Strike-through "was/now" only when a real compareAtPrice is set (PRODUCT_SYSTEM.md §3 — never auto-computed, never fabricated). */
export function PriceDisplay({
  price,
  compareAtPrice,
  currency = "USD",
  className,
}: PriceDisplayProps) {
  const onSale = typeof compareAtPrice === "number" && compareAtPrice > price;

  return (
    <span className={cn("inline-flex items-baseline gap-2 font-sans", className)}>
      <span className={cn("text-ink", onSale && "text-accent")}>
        {formatPriceForDisplay(price, currency)}
      </span>
      {onSale ? (
        <span className="text-stone line-through">
          {formatPriceForDisplay(compareAtPrice, currency)}
        </span>
      ) : null}
    </span>
  );
}
