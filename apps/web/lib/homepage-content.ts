// Hardcoded fallback homepage editorial content — used by apps/web/app/page.tsx
// only when the corresponding ContentBlock is missing/inactive in the CMS
// (ADMIN_PANEL.md §4.6, packages/api/src/routers/cms.ts's homepageContent),
// so the homepage never renders empty before that content is seeded/edited.

export const hero = {
  image: {
    url: "https://placehold.co/1920x1400/e7e4de/111111.png?text=SILONYA",
    altText: "SILONYA Autumn collection editorial photograph",
  },
  eyebrow: "Autumn 2026",
  heading: "Considered pieces, worn for years.",
  subheading: "A collection built on quality cloth and quiet construction — not trend.",
  ctaLabel: "Shop New Arrivals",
  ctaHref: "/collections/new-arrivals",
};

export const editorial = {
  image: {
    url: "https://placehold.co/1200x1500/e7e4de/111111.png?text=SILONYA+Journal",
    altText: "SILONYA editorial photograph",
  },
  eyebrow: "The Edit",
  heading: "Considered, not trend-driven",
  body: "Every SILONYA piece is chosen for how it wears in over time — quality cloth and quiet construction, not just how it photographs on day one.",
  ctaLabel: "Shop the Essentials",
  ctaHref: "/collections/the-essentials",
};

export const promo = {
  message: "Free standard delivery on orders over PKR 5,000.",
};

export const featuredCollectionSlugs = ["new-arrivals", "best-sellers", "the-essentials"] as const;
