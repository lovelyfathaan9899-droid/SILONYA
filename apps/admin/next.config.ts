import type { NextConfig } from "next";

// Security headers beyond Next.js defaults (SECURITY_ARCHITECTURE.md §3.3 —
// CSP, HSTS) are added when the admin app has real third-party assets to
// scope a CSP around; premature to write one against a single login page.
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
  // webpack-bundled module (packages/auth's native argon2 binding uses a
  // separate `eval("require")` escape hatch — see packages/auth/src/password.ts).
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
