import { defineConfig, devices } from "@playwright/test";

/**
 * Mobile-responsiveness audit/regression suite (TESTING_STRATEGY.md §5).
 * Runs against a locally-started dev server by default; point BASE_URL at
 * a Vercel preview URL to run the same checks against a real deployment.
 * Device set matches the four reference devices audited for mobile UX.
 */
const localServer = {
  command: "pnpm exec dotenv -e ../../.env -- pnpm exec next start -p 3060",
  url: "http://localhost:3060",
  reuseExistingServer: true,
  timeout: 60_000,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.BASE_URL ? undefined : 2,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3060",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "iPhone SE", use: { ...devices["iPhone SE (3rd gen)"] } },
    { name: "iPhone 15 Pro", use: { ...devices["iPhone 15 Pro"] } },
    { name: "Pixel 8", use: { ...devices["Pixel 8"] } },
    { name: "Galaxy S24", use: { ...devices["Galaxy S24"] } },
  ],
  ...(process.env.BASE_URL ? {} : { webServer: localServer }),
});
