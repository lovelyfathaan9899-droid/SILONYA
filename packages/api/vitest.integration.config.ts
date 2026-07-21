import { defineConfig } from "vitest/config";

/**
 * Integration layer (TESTING_STRATEGY.md §4) — real Postgres, not a mocked
 * Prisma client. Separate from vitest.config.ts (unit tests) because these
 * need a live TEST_DATABASE_URL and are slower; `pnpm test` stays fast and
 * DB-free, `pnpm test:integration` is opt-in / CI-gated separately.
 *
 * TEST_DATABASE_URL is read from *this* process's env (populated by
 * dotenv-cli via the `test:integration` script) and injected as
 * DATABASE_URL/DIRECT_URL for every test-runner worker process, so
 * @silonya/database's PrismaClient singleton (which reads
 * env("DATABASE_URL")/env("DIRECT_URL") per schema.prisma) resolves to the
 * test database without any application code needing to know tests exist.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    // Real Postgres connections are the whole point — don't run integration
    // files in parallel against the same database, or one test's TRUNCATE
    // races another test's assertions.
    fileParallelism: false,
    // Every query is a real network round trip to Postgres (Neon locally,
    // a service container in CI) rather than an in-process mock, and each
    // test typically makes several of them sequentially inside a
    // transaction — the unit-test default (5s) is tuned for mocked/in-memory
    // work and isn't realistic here.
    testTimeout: 30000,
    setupFiles: ["./src/test/setup-integration.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      DIRECT_URL: process.env.TEST_DIRECT_URL ?? process.env.TEST_DATABASE_URL ?? "",
    },
  },
});
