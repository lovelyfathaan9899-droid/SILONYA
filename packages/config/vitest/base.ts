import type { UserConfig } from "vitest/config";

/** Shared Vitest defaults for SILONYA's Node-only packages (packages/utils, packages/api) — PROJECT_RULES.md §1's "business logic is unit-tested" requirement. Explicit imports (`import { describe, it, expect } from "vitest"`) rather than injected globals, matching the rest of the codebase's no-implicit-globals convention. */
export const baseVitestConfig: UserConfig = {
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
};
