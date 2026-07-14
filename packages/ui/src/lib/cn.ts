import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges conditional class names and resolves Tailwind class conflicts
 * (e.g. `cn("p-2", condition && "p-4")` keeps only "p-4"). Used by every
 * primitive in this package — DESIGN_SYSTEM.md §3.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
