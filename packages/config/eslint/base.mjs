// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import vitest from "@vitest/eslint-plugin";

/**
 * Base ESLint flat config shared by every package/app in the SILONYA monorepo.
 * App-specific configs (e.g. Next.js) extend this rather than duplicating it.
 * See PROJECT_RULES.md §1 — zero-warnings policy in CI.
 */
// Tooling config files live outside every package's tsconfig "include" and
// run under typescript-eslint's synthetic "default project" rather than a
// real one — which has no custom compiler options (no strictNullChecks etc.),
// so type-checked rules that depend on those options error out rather than
// just under- or over-firing (see the disableTypeChecked block below). Both
// bare and "packages/*/"-prefixed patterns are listed because this config is
// linted two ways: per-package (cwd = that package, so paths are
// bare/relative) and from the repo root via lint-staged (root
// eslint.config.mjs, so paths are root-relative) — typescript-eslint
// disallows a leading "**" here as too broad, so a single "*" segment is
// used instead (this repo is one level deep: packages/<name>/vitest.config.ts).
const defaultProjectFiles = [
  "*.config.mjs",
  "*.config.js",
  "eslint.config.mjs",
  "vitest*.config.ts",
  "packages/*/vitest*.config.ts",
  "apps/*/vitest*.config.ts",
  "packages/config/vitest/base.ts",
  "scripts/*.mjs",
  "packages/*/scripts/*.mjs",
  "apps/*/scripts/*.mjs",
];

export const baseConfig = tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/generated/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: defaultProjectFiles,
    ...tseslint.configs.disableTypeChecked,
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: defaultProjectFiles,
        },
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Vitest's own `unbound-method` rule understands vi.fn()-derived mocks
    // (e.g. `vi.mocked(prisma.discount.findUnique)`) and doesn't flag them —
    // typescript-eslint's version does, since it can't see that the "method"
    // is a plain mock function with no real `this` binding to lose.
    files: ["**/*.test.ts"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "@typescript-eslint/unbound-method": "off",
      "vitest/unbound-method": "error",
    },
  },
  eslintConfigPrettier,
);

export default baseConfig;
