import path from "node:path";
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
  transpilePackages: [
    "@silonya/ui",
    "@silonya/utils",
    "@silonya/api",
    "@silonya/auth",
    "@silonya/database",
  ],
  // Keeps the Prisma query engine as a real runtime require rather than a
  // webpack-bundled module — without this, the native query-engine binary
  // (a real .so/.dll.node file Prisma expects to find on disk) risks being
  // pulled into a bundled chunk on serverless deploy targets.
  serverExternalPackages: ["@prisma/client"],
  // Monorepo root is two levels up from this app; without this, Next's
  // output file-tracer can fail to walk out to sibling workspace packages
  // when resolving pnpm's symlinked node_modules.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // @prisma/client and @node-rs/argon2 are both only *transitive*
  // dependencies (of packages/database and packages/auth respectively),
  // never direct dependencies of this app — under this repo's strict pnpm
  // (shamefully-hoist=false), that means neither has a resolvable
  // node_modules/<pkg> symlink at this app's own level at all, so a
  // runtime require() could never succeed here regardless of tracing
  // config, since Node's module resolution walks up from the *requiring
  // file's* eventual location in the deployed bundle, not from wherever
  // the workspace package that originally imported it happens to live.
  // Both are declared as direct dependencies in package.json specifically
  // to create real, resolvable symlinks; these includes make sure the
  // tracer actually copies their real contents (including native
  // binaries) into the deployed bundle at those same resolvable paths —
  // belt-and-suspenders for Prisma (whose engine binary load path is
  // computed at runtime, not a static require string) and load-bearing
  // for argon2 (whose require is hidden from static analysis entirely by
  // an `eval("require")` escape hatch — packages/auth/src/password.ts).
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@prisma/client/**/*",
      "./node_modules/@node-rs/argon2/**/*",
      "./node_modules/@node-rs/argon2-linux-x64-gnu/**/*",
    ],
  },
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
