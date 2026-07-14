import type { NextConfig } from "next";

// Security headers (SECURITY_ARCHITECTURE.md §3.3) and redirects
// (SEO_ARCHITECTURE.md §6) are added when those are built.
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
};

export default nextConfig;
