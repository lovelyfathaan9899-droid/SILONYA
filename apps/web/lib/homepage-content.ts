// Hardcoded homepage editorial content — analogous to real brand photography
// and copy a CMS would serve. ADMIN_PANEL.md §4.6's lightweight content
// editor isn't built yet (Phase 3+ per ROADMAP.md), so this is curated
// directly in code for now, same pattern as lib/nav-data.ts.

export const hero = {
  image: {
    url: "https://placehold.co/1920x1400/e7e4de/111111?text=SILONYA",
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
    url: "https://placehold.co/1200x1500/e7e4de/111111?text=SILONYA+Journal",
    altText: "Behind the making of a SILONYA wool coat",
  },
  eyebrow: "The Journal",
  heading: "Considered, not trend-driven",
  body: "Every SILONYA piece starts with the cloth. We work with a small group of mills across Italy and Japan, choosing fabrications for how they'll wear in — not just how they photograph on day one.",
  ctaLabel: "Read our story",
  ctaHref: "/collections/the-essentials",
};

export const promo = {
  message: "Complimentary shipping on orders over $200.",
};

export const featuredCollectionSlugs = ["new-arrivals", "best-sellers", "the-essentials"] as const;
