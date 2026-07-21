import { beforeEach } from "vitest";
import { resetDatabase } from "./db";

if (!process.env.DATABASE_URL?.includes("test")) {
  throw new Error(
    "Integration tests must run against a database whose name/URL contains " +
      '"test" (safety check against accidentally truncating dev/prod data). ' +
      "Set TEST_DATABASE_URL before running `pnpm test:integration`.",
  );
}

beforeEach(async () => {
  await resetDatabase();
});
