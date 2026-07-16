import { Link2 } from "lucide-react";
import type { FooterLinkColumn, FooterSocialLink, NavItem } from "@silonya/ui";
import { departments } from "./departments";

// Wired to the real seeded taxonomy (packages/database/prisma/seed-catalog.ts
// DEPARTMENTS/SUBCATEGORIES, mirrored in lib/departments.ts) and the
// existing curated collections. Each department gets a 2-column mega-menu
// panel: "Shop" (every subcategory) and "Featured" (the same 3 collections
// for every department, matching today's cross-department merchandising).
const featuredCollectionLinks = [
  { label: "New Arrivals", href: "/collections/new-arrivals" },
  { label: "Best Sellers", href: "/collections/best-sellers" },
  { label: "The Essentials", href: "/collections/the-essentials" },
];

export const primaryNav: NavItem[] = departments.map((department) => ({
  label: department.name,
  columns: [
    {
      heading: "Shop",
      links: [
        { label: `All ${department.name}`, href: `/categories/${department.slug}` },
        ...department.subcategories.map((sub) => ({
          label: sub.name,
          href: `/categories/${sub.slug}`,
        })),
      ],
    },
    { heading: "Featured", links: featuredCollectionLinks },
  ],
}));

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
