import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// Load .env from project root so tests can use the same env vars as the app.
dotenv.config({ path: path.resolve(__dirname, ".env") });

/**
 * Playwright configuration for NurMed E2E tests.
 *
 * Two projects:
 *   - `api`  — headless API-only tests (no browser needed)
 *   - `e2e`  — browser-based UI tests (Chromium)
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Session lifecycle tests must run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 1, // Serial execution for API cost control
  timeout: 120_000, // 2 minutes per test default
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [["html", { open: "never" }], ["json", { outputFile: "test-results.json" }], ["list"]]
    : [["html", { open: "on-failure" }], ["list"]],

  /* Shared settings */
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    /* ── API tests ─────────────────────────────────────────────── */
    {
      name: "api",
      testMatch: /tests\/api\/.*\.spec\.ts$/,
      use: {
        // No browser needed for API tests
        baseURL: process.env.STG_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://stg-api.nurmed.ai/api/v1",
      },
    },

    /* ── Data validation tests ─────────────────────────────────── */
    {
      name: "data-validation",
      testMatch: /tests\/data-validation\/.*\.spec\.ts$/,
      timeout: 900_000, // 15 min — session processing can be slow
      use: {
        baseURL: process.env.STG_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://stg-api.nurmed.ai/api/v1",
      },
    },

    /* ── E2E browser tests ─────────────────────────────────────── */
    {
      name: "e2e",
      testMatch: /tests\/e2e\/.*\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
        // Give the SPA time to hydrate
        navigationTimeout: 30_000,
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
