"use client";

import { Heart } from "lucide-react";
import { Icon } from "../icons/Icon";
import { cn } from "../lib/cn";

export interface WishlistButtonProps {
  active: boolean;
  onToggle: () => void;
  label?: string;
  className?: string;
}

/**
 * Purely controlled — no store access here (this package never imports
 * app-level state, PROJECT_RULES.md §1). apps/web wires `active`/`onToggle`
 * to its wishlist store.
 */
export function WishlistButton({
  active,
  onToggle,
  label = "Wishlist",
  className,
}: WishlistButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove from ${label.toLowerCase()}` : `Add to ${label.toLowerCase()}`}
      onClick={onToggle}
      className={cn(
        "border-mist text-ink hover:border-ink flex h-11 w-11 items-center justify-center border bg-white transition-colors duration-150",
        "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        className,
      )}
    >
      <Icon icon={Heart} size={18} className={cn(active && "fill-ink")} />
    </button>
  );
}
