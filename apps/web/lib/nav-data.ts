import { Link2 } from "lucide-react";
import type { FooterLinkColumn, FooterSocialLink, NavItem } from "@silonya/ui";

// Wired to the real seeded taxonomy (packages/database/prisma/seed-catalog.ts:
// categories "women"/"men", collections "new-arrivals"/"best-sellers"/
// "the-essentials"). Phase 3's richer sub-category columns (Dresses,
// Outerwear, Bags, Jewelry, ...) are removed rather than left as "#"
// placeholders — those categories don't exist in the catalog yet, and a
// dead link fails PROJECT_RULES.md's production-ready bar. Add them back
// once PRODUCT_SYSTEM.md's category tree grows past two top-level nodes.
export const primaryNav: NavItem[] = [
  {
    label: "Women",
    columns: [
      {
        heading: "Shop",
        links: [
          { label: "All Women", href: "/categories/women" },
          { label: "New Arrivals", href: "/collections/new-arrivals" },
          { label: "Best Sellers", href: "/collections/best-sellers" },
          { label: "The Essentials", href: "/collections/the-essentials" },
        ],
      },
    ],
  },
  {
    label: "Men",
    columns: [
      {
        heading: "Shop",
        links: [
          { label: "All Men", href: "/categories/men" },
          { label: "New Arrivals", href: "/collections/new-arrivals" },
          { label: "Best Sellers", href: "/collections/best-sellers" },
          { label: "The Essentials", href: "/collections/the-essentials" },
        ],
      },
    ],
  },
];

export const footerColumns: FooterLinkColumn[] = [
  {
    heading: "Help",
    links: [
      { label: "Shipping & Returns", href: "#" },
      { label: "Size Guide", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "About",
    links: [
      { label: "Our Story", href: "#" },
      { label: "Sustainability", href: "#" },
      { label: "Careers", href: "#" },
    ],
  },
];

export const footerLegalLinks = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
];

// Lucide's brand icons (Instagram/Twitter/Facebook) are deprecated
// (lucide-icons/lucide#670) — using a generic glyph here since these are
// placeholder "#" links anyway; swap in real brand icons (e.g. via
// simple-icons) once real social accounts are wired up.
export const footerSocialLinks: FooterSocialLink[] = [
  { label: "Instagram", href: "#", icon: Link2 },
  { label: "Twitter", href: "#", icon: Link2 },
  { label: "Facebook", href: "#", icon: Link2 },
];
