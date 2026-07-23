import path from "node:path";
import type { NextConfig } from "next";

// SECURITY_ARCHITECTURE.md §3.3 — same script-src caveat as apps/web/next.config.ts
// (inline ThemeScript, no nonce implementation yet).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://res.cloudinary.com https://placehold.co",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Admin is a trusted-network internal tool but still gets a defense-in-depth
  // hint against indexing (ADMIN_PANEL.md §1 — separate deployment/domain).
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@silonya/ui",
    "@silonya/utils",
    "@silonya/api",
    "@silonya/auth",
    "@silonya/database",
  ],
  // Keeps the Prisma query engine as a real runtime require rather than a
  // webpack-bundled module — see apps/web/next.config.ts for the full
  // rationale (same monorepo, same failure mode; @node-rs/argon2's native
  // binary is handled via packages/auth/src/password.ts's eval("require")
  // escape hatch plus the outputFileTracingIncludes entry below).
  serverExternalPackages: ["@prisma/client"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@node-rs/argon2/**/*",
      "./node_modules/@node-rs/argon2-linux-x64-gnu/**/*",
    ],
  },
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  },
};

export default nextConfig;
