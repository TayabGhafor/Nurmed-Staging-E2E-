/**
 * Authentication helper for E2E tests.
 *
 * Uses the Supabase JS client to obtain a fresh access_token via
 * signInWithPassword(). The token is cached for the lifetime of the
 * test worker so we don't re-authenticate on every test.
 */

import { createClient } from "@supabase/supabase-js";

// ── Configuration ──────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://wyazvpkxaqfjenxqpjwu.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const TEST_EMAIL =
  process.env.TEST_EMAIL || "nurmedaitest@mailinator.com";

const TEST_PASSWORD = process.env.TEST_PASSWORD || "Pass@123";

// ── Token cache ────────────────────────────────────────────────────────────

let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Authenticate with Supabase and return a fresh Bearer access_token.
 * Caches the token and reuses it until it's close to expiry.
 */
export async function getAuthToken(): Promise<string> {
  // Reuse cached token if it's still valid (with 60s margin)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    throw new Error(`E2E auth failed: ${error.message}`);
  }

  if (!data.session) {
    throw new Error("E2E auth failed: no session returned");
  }

  cachedToken = data.session.access_token;
  cachedRefreshToken = data.session.refresh_token;
  tokenExpiresAt = Date.now() + data.session.expires_in * 1000;

  return cachedToken;
}

/**
 * Returns an Authorization header object ready for fetch().
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Attempt login with custom credentials. Returns the full auth response.
 * Used by login test cases to test various credential combinations.
 */
export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<{
  success: boolean;
  token?: string;
  error?: string;
  user?: any;
  session?: any;
}> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data.session) {
    return { success: false, error: "No session returned" };
  }

  return {
    success: true,
    token: data.session.access_token,
    user: data.user,
    session: data.session,
  };
}

/**
 * Clear the cached token (useful for testing fresh login scenarios).
 */
export function clearTokenCache(): void {
  cachedToken = null;
  cachedRefreshToken = null;
  tokenExpiresAt = 0;
}

export { TEST_EMAIL, TEST_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY };
