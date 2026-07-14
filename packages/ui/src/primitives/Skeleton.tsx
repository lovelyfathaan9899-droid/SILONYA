import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Loading placeholder block. Pulses via Tailwind's `motion-safe:animate-pulse`
 * — the `motion-safe:` prefix scopes the animation to
 * `@media (prefers-reduced-motion: no-preference)`, so it's simply static
 * (still a visible placeholder, just not animated) for users who've
 * requested reduced motion (DESIGN_SYSTEM.md §6).
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("bg-mist motion-safe:animate-pulse", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
