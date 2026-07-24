import { cn } from "../lib/cn";

export interface WordmarkProps {
  className?: string;
}

// Tracking widened to ~10% of type size (tracking-widest) rather than a
// tighter default — a wordmark-only logo (identity strategy: no mascot)
// relies on open tracking for its presence, since there's no accompanying
// symbol to carry visual weight.
/**
 * The SILONYA text mark — the single place the brand name's markup lives
 * (PROJECT_RULES.md: never hardcode the brand name in multiple places), so
 * swapping in a real logo image/SVG later only requires changing this one
 * component. Unstyled positioning/sizing beyond type size — callers wrap it
 * in whatever link/nav element and size class fits their layout.
 */
export function Wordmark({ className }: WordmarkProps) {
  return <span className={cn("font-display text-ink tracking-widest", className)}>SILONYA</span>;
}
