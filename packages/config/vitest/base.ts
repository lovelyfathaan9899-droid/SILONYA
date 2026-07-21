import { configDefaults, type UserConfig } from "vitest/config";

/**
 * Shared Vitest defaults for SILONYA's Node-only packages (packages/utils,
 * packages/api) — PROJECT_RULES.md §1's "business logic is unit-tested"
 * requirement. Explicit imports (`import { describe, it, expect } from
 * "vitest"`) rather than injected globals, matching the rest of the
 * codebase's no-implicit-globals convention.
 *
 * `*.integration.test.ts` is excluded here (TESTING_STRATEGY.md §4's
 * separate layer, packages/api/vitest.integration.config.ts) — without this,
 * `**\/*.test.ts` also matches `index.integration.test.ts`, and this suite
 * has no TEST_DATABASE_URL/db-reset setup to run it against.
 */
export const baseVitestConfig: UserConfig = {
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
};
