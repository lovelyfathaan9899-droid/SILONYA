import { nextConfig } from "@silonya/config/eslint/next";

export default [
  ...nextConfig,
  {
    ignores: [".next/**"],
  },
];
