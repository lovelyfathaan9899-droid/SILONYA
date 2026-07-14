import { nextConfig } from "@silonya/config/eslint/next";

// ESLint's flat config is resolved once per invocation from CWD — it does
// not automatically cascade into each app/package's own eslint.config.mjs
// the way legacy .eslintrc did. Every per-package `lint` script (and CI)
// runs with cwd = that package, so it always finds its own config first;
// this root config exists only for tools that run from the repo root
// (lint-staged, via .husky/pre-commit) with files from anywhere in the
// monorepo. `nextConfig` is the broadest of the three shared configs
// (base + React + Next rules) — a reasonable pre-commit pass across every
// package's TS/TSX/JS/JSX files; it isn't a substitute for each package's
// own `pnpm lint`, which stays the authoritative gate in CI.
export default [...nextConfig];
