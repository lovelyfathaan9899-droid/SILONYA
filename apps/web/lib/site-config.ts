// No production domain exists yet (task #23 — real hosting/DNS is still
// pending) — NEXT_PUBLIC_SITE_URL lets deploys set the real origin once one
// exists; every SEO surface (metadataBase, sitemap, robots, canonical URLs,
// JSON-LD) reads from here so there's one place to update.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_NAME = "SILONYA";
