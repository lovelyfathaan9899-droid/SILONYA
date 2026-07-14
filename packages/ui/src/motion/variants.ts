import type { Variants } from "framer-motion";

/**
 * Shared Framer Motion variants (DESIGN_SYSTEM.md §2.5 — "purposeful only,"
 * 150-300ms, ease-out). Components consume these rather than inventing new
 * transitions, so motion feels consistent across the whole app.
 */

const EASE_EDITORIAL: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: EASE_EDITORIAL } },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_EDITORIAL } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE_EDITORIAL } },
};

export const staggerChildren: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};
