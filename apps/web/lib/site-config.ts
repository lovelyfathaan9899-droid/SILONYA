// No production domain exists yet (task #23 — real hosting/DNS is still
// pending) — NEXT_PUBLIC_APP_URL lets deploys set the real origin once one
// exists; every SEO surface (metadataBase, sitemap, robots, canonical URLs,
// JSON-LD) reads from here so there's one place to update. Must match the
// variable name used everywhere else (packages/api/src/lib/site-url.ts,
// .env.example, turbo.json's build env allowlist) — a different name here
// silently fell back to localhost in every environment, including production.
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
export const SITE_NAME = "SILONYA";
