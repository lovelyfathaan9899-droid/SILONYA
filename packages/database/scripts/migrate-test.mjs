// Applies pending migrations to TEST_DATABASE_URL (TESTING_STRATEGY.md §4).
// `prisma migrate deploy` has no --url flag, so DATABASE_URL/DIRECT_URL are
// overridden for the child process instead — via spawnSync's `env` option,
// not shell-level variable syntax, so this works the same on Windows
// PowerShell as it does on bash/CI. Invoked as `dotenv -e ../../.env --
// node scripts/migrate-test.mjs`, so TEST_DATABASE_URL is already in
// process.env by the time this runs.
import { spawnSync } from "node:child_process";

// Migrations should run against a direct (non-pooled) connection, same
// reasoning as DATABASE_URL/DIRECT_URL for the dev database — falls back to
// TEST_DATABASE_URL for a single-URL setup (e.g. a CI postgres: service
// container, which has no separate pooled endpoint).
const testUrl = process.env.TEST_DIRECT_URL ?? process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error(
    "TEST_DATABASE_URL is not set in .env — see .env.example (TESTING_STRATEGY.md §4).",
  );
  process.exit(1);
}

const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
});

process.exit(result.status ?? 1);
