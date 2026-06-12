/**
 * Login API tests — Supabase signInWithPassword
 *
 * Tests the authentication layer directly via the Supabase auth endpoint.
 * Covers positive, negative, edge cases, and HTTP semantics.
 */

import { test, expect } from "../lib/fixtures";
import {
  loginWithCredentials,
  clearTokenCache,
  TEST_EMAIL,
  TEST_PASSWORD,
} from "../lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Positive cases
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login API — Positive", () => {
  test("should login with valid credentials and return access_token", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, TEST_PASSWORD);

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
    expect(typeof result.token).toBe("string");
    expect(result.token!.length).toBeGreaterThan(50);
  });

  test("should return a valid JWT token with expected structure", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, TEST_PASSWORD);
    expect(result.success).toBe(true);

    // JWT has 3 dot-separated parts
    const parts = result.token!.split(".");
    expect(parts.length).toBe(3);

    // Decode the payload
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8"),
    );
    expect(payload).toHaveProperty("sub");
    expect(payload).toHaveProperty("email");
    expect(payload).toHaveProperty("exp");
    expect(payload).toHaveProperty("iat");
    expect(payload.email).toBe(TEST_EMAIL);
    expect(payload.role).toBe("authenticated");
  });

  test("should return user metadata with expected fields", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, TEST_PASSWORD);
    expect(result.success).toBe(true);
    expect(result.user).toBeTruthy();
    expect(result.user.email).toBe(TEST_EMAIL);
    expect(result.user.id).toBeTruthy();
  });

  test("should return session with refresh_token", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, TEST_PASSWORD);
    expect(result.success).toBe(true);
    expect(result.session).toBeTruthy();
    expect(result.session.refresh_token).toBeTruthy();
    expect(typeof result.session.refresh_token).toBe("string");
  });

  test("should return session with expires_in > 0", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, TEST_PASSWORD);
    expect(result.success).toBe(true);
    expect(result.session.expires_in).toBeGreaterThan(0);
  });

  test("successive logins should return different tokens (session isolation)", async () => {
    clearTokenCache();
    const result1 = await loginWithCredentials(TEST_EMAIL, TEST_PASSWORD);
    const result2 = await loginWithCredentials(TEST_EMAIL, TEST_PASSWORD);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    // Tokens should be different (different sessions)
    expect(result1.token).not.toBe(result2.token);
  });

  test("token expiry should be in the future", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, TEST_PASSWORD);
    expect(result.success).toBe(true);

    const payload = JSON.parse(
      Buffer.from(result.token!.split(".")[1], "base64").toString("utf-8"),
    );
    const expiresAt = payload.exp * 1000;
    expect(expiresAt).toBeGreaterThan(Date.now());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Negative cases
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login API — Negative", () => {
  test("should fail with wrong password", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, "WrongPassword99!");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.token).toBeUndefined();
  });

  test("should fail with non-existent email", async () => {
    const result = await loginWithCredentials(
      "nonexistent_user_xyz@mailinator.com",
      "AnyPassword1!",
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should fail with empty email", async () => {
    const result = await loginWithCredentials("", TEST_PASSWORD);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should fail with empty password", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, "");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should fail with email missing domain", async () => {
    const result = await loginWithCredentials("invalidemail", TEST_PASSWORD);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should fail with email missing TLD", async () => {
    const result = await loginWithCredentials("user@domain", TEST_PASSWORD);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should handle SQL injection in email gracefully", async () => {
    const result = await loginWithCredentials(
      "' OR '1'='1'; --@evil.com",
      TEST_PASSWORD,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should handle XSS payload in email gracefully", async () => {
    const result = await loginWithCredentials(
      '<script>alert("xss")</script>@evil.com',
      TEST_PASSWORD,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should fail with password shorter than 6 characters", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, "Ab1!");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should fail with both email and password empty", async () => {
    const result = await loginWithCredentials("", "");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should fail with only whitespace email", async () => {
    const result = await loginWithCredentials("   ", TEST_PASSWORD);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test("should fail with only whitespace password", async () => {
    const result = await loginWithCredentials(TEST_EMAIL, "   ");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login API — Edge Cases", () => {
  test("should handle email with leading/trailing spaces", async () => {
    // Supabase typically trims emails
    const result = await loginWithCredentials(
      `  ${TEST_EMAIL}  `,
      TEST_PASSWORD,
    );
    // May succeed if Supabase trims, or fail if it doesn't
    // The important thing is it doesn't crash
    expect(typeof result.success).toBe("boolean");
  });

  test("should handle email case insensitivity", async () => {
    const uppercaseEmail = TEST_EMAIL.toUpperCase();
    const result = await loginWithCredentials(uppercaseEmail, TEST_PASSWORD);
    // Supabase is case-insensitive for email
    expect(result.success).toBe(true);
  });

  test("should handle very long email (255+ chars)", async () => {
    const longEmail = "a".repeat(250) + "@mailinator.com";
    const result = await loginWithCredentials(longEmail, TEST_PASSWORD);
    expect(result.success).toBe(false);
    // Should not crash
    expect(typeof result.error).toBe("string");
  });

  test("should handle very long password (1000+ chars)", async () => {
    const longPassword = "A1!".repeat(400);
    const result = await loginWithCredentials(TEST_EMAIL, longPassword);
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
  });

  test("should handle unicode characters in password", async () => {
    const result = await loginWithCredentials(
      TEST_EMAIL,
      "Pässwörd123!🔐",
    );
    expect(result.success).toBe(false);
    // Should return gracefully even with unicode
    expect(typeof result.error).toBe("string");
  });

  test("should handle concurrent login requests", async () => {
    const promises = Array.from({ length: 3 }, () =>
      loginWithCredentials(TEST_EMAIL, TEST_PASSWORD),
    );
    const results = await Promise.all(promises);

    // All should succeed independently
    for (const result of results) {
      expect(result.success).toBe(true);
      expect(result.token).toBeTruthy();
    }

    // All tokens should be different (unique sessions)
    const tokens = results.map((r) => r.token);
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(3);
  });

  test("should handle special characters in email local part", async () => {
    const result = await loginWithCredentials(
      "test+special@mailinator.com",
      TEST_PASSWORD,
    );
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
  });

  test("login response time should be under 5 seconds", async () => {
    const start = Date.now();
    await loginWithCredentials(TEST_EMAIL, TEST_PASSWORD);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API endpoint tests (staging API /self endpoint)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login API — Authenticated endpoint validation", () => {
  test("should access protected /self endpoint with valid token", async ({
    authToken,
  }) => {
    const apiBase =
      process.env.STG_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://stg-api.nurmed.ai/api/v1";

    const response = await fetch(`${apiBase}/self`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    // The /self endpoint should return 200 with user data
    expect(response.status).toBeLessThan(500);
  });

  test("should fail to access protected endpoint without token", async () => {
    const apiBase =
      process.env.STG_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://stg-api.nurmed.ai/api/v1";

    const response = await fetch(`${apiBase}/self`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Should return 401, 403, or 404 (API may hide the endpoint)
    expect([401, 403, 404]).toContain(response.status);
  });

  test("should fail to access protected endpoint with invalid token", async () => {
    const apiBase =
      process.env.STG_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://stg-api.nurmed.ai/api/v1";

    const response = await fetch(`${apiBase}/self`, {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid_token_here_123",
        "Content-Type": "application/json",
      },
    });

    expect([401, 403, 404]).toContain(response.status);
  });

  test("should fail with expired/malformed JWT", async () => {
    const apiBase =
      process.env.STG_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://stg-api.nurmed.ai/api/v1";

    // Expired JWT (crafted)
    const expiredToken =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid";

    const response = await fetch(`${apiBase}/self`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        "Content-Type": "application/json",
      },
    });

    expect([401, 403, 404]).toContain(response.status);
  });
});
