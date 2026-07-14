import type { Metadata } from "next";
import type { ReactNode } from "react";

// Internal reference page (DESIGN_SYSTEM.md living component set) — never
// indexed, never linked from customer-facing navigation.
export const metadata: Metadata = {
  title: "Style Guide — SILONYA",
  robots: { index: false, follow: false },
};

export default function StyleGuideLayout({ children }: { children: ReactNode }) {
  return children;
}
