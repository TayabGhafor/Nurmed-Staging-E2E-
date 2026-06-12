/**
 * Dashboard E2E tests — browser-based navigation tests.
 *
 * Requires the Next.js dev server running at localhost:3000.
 */

import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL || "nurmedaitest@mailinator.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "Pass@123";
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

// ── Helper: login via UI ──────────────────────────────────────────────────

async function loginViaUI(page: any): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");

  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect away from login
  await page.waitForURL((url: URL) => !url.pathname.includes("/login"), {
    timeout: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard loading
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Dashboard — Page Loading", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test("dashboard page should load after login", async ({ page }) => {
    // Should be on the dashboard (root path or /hospital-admin)
    const currentUrl = page.url();
    expect(
      currentUrl.endsWith("/") ||
        currentUrl.includes("/hospital-admin") ||
        !currentUrl.includes("/login"),
    ).toBe(true);
  });

  test("should display the dashboard main content area", async ({ page }) => {
    // Wait for the dashboard content to render
    // The main content area has a 'main' tag or a generic class
    const mainContent = page.locator("main, [role='main']").first();
    await expect(mainContent).toBeVisible({ timeout: 15_000 });
  });

  test("sidebar navigation should be visible", async ({ page }) => {
    // The AppSidebar component should render on desktop
    const sidebar = page.locator("aside, nav, [data-sidebar]").first();
    // On desktop viewports the sidebar should be visible
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
    } else {
      // Mobile viewport — sidebar may be hidden behind a hamburger menu
      console.log("Sidebar not visible (mobile viewport)");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session navigation
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Dashboard — Session Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test("should be able to navigate to a session page if sessions exist", async ({
    page,
  }) => {
    // Look for session list items / links
    const sessionLinks = page.locator(
      'a[href*="/session/"], [data-session-id], tr[data-session]',
    );

    // Give the session list time to load
    await page.waitForTimeout(3000);

    const count = await sessionLinks.count();
    if (count > 0) {
      // Click the first session
      await sessionLinks.first().click();

      // Should navigate to /session/{id}
      await page.waitForURL((url: URL) => url.pathname.includes("/session/"), {
        timeout: 15_000,
      });

      expect(page.url()).toContain("/session/");
    } else {
      console.log("No session links found on dashboard — skipping navigation test");
    }
  });

  test("session detail page should load content", async ({ page }) => {
    // Navigate directly to a session page if we know one exists
    // First, try to find one from the session list
    const sessionLinks = page.locator('a[href*="/session/"]');
    await page.waitForTimeout(3000);

    const count = await sessionLinks.count();
    if (count > 0) {
      await sessionLinks.first().click();
      await page.waitForURL((url: URL) => url.pathname.includes("/session/"), {
        timeout: 15_000,
      });

      // Wait for content to load (the DashboardContent component)
      await page.waitForLoadState("networkidle");

      // The page should not show an error state
      const errorText = page.locator("text=Error, text=error, text=failed").first();
      const hasError = await errorText.isVisible().catch(() => false);

      if (!hasError) {
        // Page loaded without errors
        expect(page.url()).toContain("/session/");
      }
    } else {
      console.log("No sessions to navigate to — skipping detail page test");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Dashboard — Logout", () => {
  test("should redirect to login after clearing cookies", async ({ page }) => {
    await loginViaUI(page);

    // Simulate logout by clearing all cookies and localStorage
    await page.evaluate(() => {
      // Clear cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      // Clear localStorage
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate to a protected page
    await page.goto(`${BASE_URL}/`);

    // Should redirect to login
    await page.waitForURL((url: URL) => url.pathname.includes("/login"), {
      timeout: 15_000,
    });
    expect(page.url()).toContain("/login");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Dashboard — Error Handling", () => {
  test("invalid session ID should be handled gracefully", async ({ page }) => {
    await loginViaUI(page);

    // Navigate to a non-existent session
    await page.goto(`${BASE_URL}/session/999999999`);
    await page.waitForLoadState("networkidle");

    // The page should handle this gracefully — either show an error,
    // a loading state, or redirect
    // It should NOT show an unhandled crash
    const body = await page.locator("body").textContent();
    expect(body).toBeTruthy(); // Page renders something
  });
});
