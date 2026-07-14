import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Render as a different element (e.g. "main", "section") without a wrapper div. */
  as?: ElementType;
  /** Caps content width; "full" removes the max-width for edge-to-edge sections (e.g. a full-bleed hero). */
  size?: "default" | "narrow" | "full";
}

const SIZE_CLASSES: Record<NonNullable<ContainerProps["size"]>, string> = {
  default: "max-w-[90rem]",
  narrow: "max-w-[65ch]",
  full: "max-w-none",
};

/**
 * Reusable page container — horizontal max-width + responsive gutter
 * padding (DESIGN_SYSTEM.md §2.3: 24px mobile, 32px+ desktop gutters).
 * Every page-level section wraps its content in this rather than
 * reinventing padding per page.
 */
export function Container({
  children,
  className,
  as: Component = "div",
  size = "default",
  ...props
}: ContainerProps) {
  return (
    <Component
      className={cn("mx-auto w-full px-3 md:px-4", SIZE_CLASSES[size], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
