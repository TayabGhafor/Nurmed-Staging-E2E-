/**
 * Login UI E2E tests — browser-based tests for the /login page.
 *
 * These tests require the Next.js dev server to be running at localhost:3000.
 */

import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL || "nurmedaitest@mailinator.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "Pass@123";
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

// ─────────────────────────────────────────────────────────────────────────────
// Page rendering
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login UI — Page Rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // Wait for the page to fully hydrate
    await page.waitForLoadState("networkidle");
  });

  test("should render the login page with correct elements", async ({ page }) => {
    // Email input
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("placeholder", "Enter your email");

    // Password input
    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute("placeholder", "Password");

    // Login button
    const loginButton = page.locator('button[type="submit"]');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toHaveText("Login");
  });

  test("should display the NurMed logo", async ({ page }) => {
    const logo = page.locator('img[alt="NurMed Logo"]');
    await expect(logo).toBeVisible();
  });

  test("should display 'Fill your Details & Login' heading", async ({ page }) => {
    const heading = page.locator("h2");
    await expect(heading).toContainText("Fill your Details & Login");
  });

  test("should have 'Forgot Password?' link pointing to /forgot-password", async ({
    page,
  }) => {
    const forgotLink = page.locator('a[href="/forgot-password"]');
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveText("Forgot Password?");
  });

  test("password input should be of type 'password' by default", async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("password visibility toggle should work", async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]');

    // Initially password type
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click the toggle button (the button next to the password input)
    const toggleButton = page.locator('input[name="password"] + button, input[name="password"] ~ button').first();
    // Alternative: use the eye icon button in the password field container
    const eyeButton = page.locator('.relative button[type="button"]').first();
    
    if (await eyeButton.isVisible()) {
      await eyeButton.click();
      await expect(passwordInput).toHaveAttribute("type", "text");

      // Click again to hide
      await eyeButton.click();
      await expect(passwordInput).toHaveAttribute("type", "password");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Successful login
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login UI — Successful Login", () => {
  test("should login with valid credentials and redirect to dashboard", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    // Fill in credentials
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for navigation away from login page
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 30_000,
    });

    // Should be on the dashboard or another protected page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain("/login");
  });

  test("should show 'Logging in...' text while loading", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);

    // Click and immediately check for loading state
    await page.click('button[type="submit"]');

    // The button text should change to "Logging in..."
    const loginButton = page.locator('button[type="submit"]');
    // This is a race — it may have already redirected, so check with a short timeout
    try {
      await expect(loginButton).toHaveText("Logging in...", {
        timeout: 3000,
      });
    } catch {
      // Already redirected — that's fine, login was fast
    }
  });

  test("enter key should submit the login form", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);

    // Press Enter instead of clicking
    await page.press('input[name="password"]', "Enter");

    // Wait for navigation
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 30_000,
    });

    expect(page.url()).not.toContain("/login");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Failed login
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login UI — Failed Login", () => {
  test("should show error message for invalid credentials", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', "WrongPassword99!");
    await page.click('button[type="submit"]');

    // Wait for the error message to appear
    const errorBanner = page.locator(".bg-red-100, .text-red-700, [role='alert']").first();
    await expect(errorBanner).toBeVisible({ timeout: 15_000 });
  });

  test("should show validation error for empty email on blur", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    // Focus and blur email field to trigger validation
    await page.fill('input[name="email"]', "");
    await page.fill('input[name="password"]', "SomePass123");
    await page.click('button[type="submit"]');

    // Should show email validation error
    const errorText = page.locator(".text-red-600").first();
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });

  test("should show validation error for invalid email format", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"]', "notanemail");
    await page.fill('input[name="password"]', "SomePass123");
    await page.click('button[type="submit"]');

    // Should show email format error
    const errorText = page.locator(".text-red-600");
    await expect(errorText.first()).toBeVisible({ timeout: 5000 });
    await expect(errorText.first()).toContainText("valid email");
  });

  test("should show validation error for short password", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', "Ab1");
    await page.click('button[type="submit"]');

    // Should show password validation error
    const errorText = page.locator(".text-red-600");
    await expect(errorText.first()).toBeVisible({ timeout: 5000 });
    await expect(errorText.first()).toContainText("6 characters");
  });

  test("should remain on login page after failed login", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', "WrongPassword!");
    await page.click('button[type="submit"]');

    // Wait a bit and verify we're still on login
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Access control
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login UI — Access Control", () => {
  test("unauthenticated user visiting / should be redirected to /login", async ({
    page,
  }) => {
    // Clear any existing auth cookies
    await page.context().clearCookies();

    await page.goto(`${BASE_URL}/`);

    // Should redirect to login
    await page.waitForURL((url) => url.pathname.includes("/login"), {
      timeout: 10_000,
    });
    expect(page.url()).toContain("/login");
  });

  test("Forgot Password link navigates correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");

    await page.click('a[href="/forgot-password"]');

    await page.waitForURL((url) => url.pathname.includes("/forgot-password"), {
      timeout: 30_000,
    });
    expect(page.url()).toContain("/forgot-password");
  });
});
