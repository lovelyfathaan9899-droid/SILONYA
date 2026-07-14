import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * DESIGN_SYSTEM.md §2.3 — 4-column grid on mobile, 12-column from `lg`
 * (1024px) up, with the documented gutter widths (24px mobile, 32px+
 * desktop — --spacing-3 / --spacing-4). Children position themselves with
 * standard Tailwind `col-span-*` utilities.
 */
export function Grid({ children, className, ...props }: GridProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-3 md:gap-4 lg:grid-cols-12", className)} {...props}>
      {children}
    </div>
  );
}
