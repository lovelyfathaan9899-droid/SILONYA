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
  // pulled into a bundled chunk on serverless deploy targets. @node-rs/argon2
  // needs the same protection but reaches it via an `eval("require")`
  // escape hatch instead (packages/auth/src/password.ts).
  serverExternalPackages: ["@prisma/client"],
  // Monorepo root is two levels up from this app; without this, Next's
  // output file-tracer sometimes fails to walk out to sibling workspace
  // packages (packages/database) when resolving pnpm's symlinked
  // node_modules, which is one reason the Prisma query engine went missing
  // from the deployed Vercel function despite building fine
  // (https://pris.ly/d/engine-not-found-nextjs).
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Explicit belt-and-suspenders inclusion of both native binaries:
  //  - Prisma's engine load path is computed at runtime, not a static
  //    require string, so even correct tracing can miss it.
  //  - @node-rs/argon2 is only a transitive dependency of packages/auth,
  //    not a direct dependency of this app — under this repo's strict pnpm
  //    (shamefully-hoist=false), that means it has NO resolvable
  //    node_modules/@node-rs/argon2 symlink at this app's own level at all,
  //    so require("@node-rs/argon2") could never succeed here regardless
  //    of tracing. It's declared as a direct dependency in package.json
  //    specifically to create that symlink; this include just makes sure
  //    the tracer (which can't see the require, hidden behind eval) still
  //    copies it into the deployed bundle.
  outputFileTracingIncludes: {
    "/**": [
      "../../packages/database/generated/client/**/*",
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
