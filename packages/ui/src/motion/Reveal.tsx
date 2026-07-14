"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const EASE_EDITORIAL: [number, number, number, number] = [0.16, 1, 0.3, 1];

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger delay in seconds, for revealing a sequence of siblings. */
  delay?: number;
}

/**
 * Fades/slides content in once it scrolls into view — the one "scroll
 * animation" pattern DESIGN_SYSTEM.md §2.5 sanctions (purposeful, not
 * decorative). Respects `prefers-reduced-motion`: renders content with no
 * animation at all rather than a reduced-but-still-present one.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.3, ease: EASE_EDITORIAL, delay }}
    >
      {children}
    </motion.div>
  );
}
