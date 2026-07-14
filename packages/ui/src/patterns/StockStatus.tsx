import { cn } from "../lib/cn";

export interface StockStatusProps {
  available: boolean;
  /** Pass the real quantity to show "Only N left" — omit to just show "In stock" (DESIGN_SYSTEM.md §4 principle 2: real counts only, never fake urgency). */
  quantityOnHand?: number;
  lowStockThreshold?: number;
  className?: string;
}

export function StockStatus({
  available,
  quantityOnHand,
  lowStockThreshold = 5,
  className,
}: StockStatusProps) {
  if (!available) {
    return <span className={cn("text-stone font-sans text-sm", className)}>Out of stock</span>;
  }

  const isLow = typeof quantityOnHand === "number" && quantityOnHand <= lowStockThreshold;

  return (
    <span className={cn("text-success font-sans text-sm", className)}>
      {isLow ? `Only ${String(quantityOnHand)} left` : "In stock"}
    </span>
  );
}
