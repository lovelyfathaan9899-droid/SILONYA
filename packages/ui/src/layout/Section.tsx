import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Container } from "./Container";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: ElementType;
  /** Background tone — "transparent" inherits the page background. */
  tone?: "transparent" | "bone" | "white" | "ink";
  /** Vertical rhythm — DESIGN_SYSTEM.md §2.3's generous negative space. */
  spacing?: "sm" | "md" | "lg";
  /** Wrap children in <Container>; disable when the section needs full-bleed content (e.g. an edge-to-edge image) with its own internal container. */
  container?: boolean;
}

const TONE_CLASSES: Record<NonNullable<SectionProps["tone"]>, string> = {
  transparent: "",
  bone: "bg-bone text-ink",
  white: "bg-white text-ink",
  ink: "bg-ink text-white",
};

const SPACING_CLASSES: Record<NonNullable<SectionProps["spacing"]>, string> = {
  sm: "py-6 md:py-8",
  md: "py-8 md:py-10",
  lg: "py-10 md:py-12",
};

/**
 * The vertical rhythm building block every page section uses instead of
 * ad-hoc padding — keeps spacing between sections consistent across the
 * whole site (DESIGN_SYSTEM.md §1 principle 3, "consistency compounds").
 */
export function Section({
  children,
  className,
  as: Component = "section",
  tone = "transparent",
  spacing = "md",
  container = true,
  ...props
}: SectionProps) {
  return (
    <Component className={cn(TONE_CLASSES[tone], SPACING_CLASSES[spacing], className)} {...props}>
      {container ? <Container>{children}</Container> : children}
    </Component>
  );
}
