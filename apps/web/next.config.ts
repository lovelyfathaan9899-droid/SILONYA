import type { NextConfig } from "next";

// Redirects (SEO_ARCHITECTURE.md §6, the Redirect table) are added when
// that feature is built — this only covers security headers.
//
// SECURITY_ARCHITECTURE.md §3.3 — script-src intentionally still allows
// 'unsafe-inline' rather than the documented nonce-based approach: this app
// renders inline <script> tags in several places (ThemeScript in
// packages/ui, per-page JSON-LD structured data via
// dangerouslySetInnerHTML). A correct nonce implementation needs a
// per-request nonce generated in middleware and threaded through every one
// of those call sites; that's a real follow-up, not shipped here. Every
// other directive is locked down for real.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://res.cloudinary.com https://placehold.co",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@silonya/ui", "@silonya/utils", "@silonya/api", "@silonya/database"],
  images: {
    remotePatterns: [
      // Cloudinary — real product photography (TECH_STACK.md §2).
      { protocol: "https", hostname: "res.cloudinary.com" },
      // placehold.co — seed/demo imagery only (packages/database/prisma/seed-catalog.ts).
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  },
};

export default nextConfig;
