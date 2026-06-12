# Signup and Auth Flow (Supabase)

This document explains how public signup and authentication currently work in this project, including where Supabase stores data and how session state is persisted in the frontend.

## High-level flow

1. Public user opens `/signup`.
2. User submits:
   - `first_name`
   - `last_name`
   - `email`
   - `address`
   - `organization` (optional)
   - `password`
3. Frontend calls Supabase `auth.signUp(...)` via auth service.
4. Supabase creates an auth user and sends email verification.
5. User verifies email from mailbox.
6. User logs in from `/login` (email/password) or via Google OAuth.
7. App stores auth/session state in cookies + localStorage for middleware and client-side usage.

---

## Files involved

- Signup page: `app/(pages)/(auth)/signup/page.tsx`
- Login page: `app/(pages)/(auth)/login/page.tsx`
- Auth context: `app/contexts/AuthContext.tsx`
- Auth facade: `app/kyClient/auth.ts`
- Supabase auth service: `app/kyClient/supabaseAuth.ts`
- Supabase client: `app/lib/supabase.ts`
- Route guard middleware: `middleware.ts`
- Auth layout redirect logic: `app/(pages)/(auth)/layout.tsx`

---

## Public signup: what happens exactly

### 1) Form submission

`/signup` uses Formik + Yup and calls:

- `useAuth().signup(...)` from `AuthContext`
- which calls `authService.signup(...)`
- which calls `supabaseAuthService.signup(...)`

### 2) Supabase sign up call

`supabaseAuthService.signup(...)` calls:

- `supabase.auth.signUp({ email, password, options })`

Important options:

- `emailRedirectTo`: built from current origin (or `NEXT_PUBLIC_SITE_URL`)
- `data`: stored in Supabase `auth.users.raw_user_meta_data`
  - `first_name`
  - `last_name`
  - `address`
  - `organization` (empty string if omitted)
  - `role: ['doctor']` (default in this app)

### 3) Duplicate email handling

After signUp, service checks identities edge-case (`identities.length === 0`) and returns a clean "already exists" error when needed.

### 4) Verification required

Success message tells user to verify email before login. This flow is intentionally non-auto-login.

---

## Login and session flow

## Email/password login

`/login` calls `login(email, password)`:

- `supabase.auth.signInWithPassword(...)`
- then app fetches `doctor` row by `user_id` to enrich profile data
- then app persists auth data (cookies + localStorage)

## Google OAuth login

`/login` -> `signInWithGoogle(...)`:

- uses `supabase.auth.signInWithOAuth(...)`
- callback returns to `/callback` (or token hash can land on `/login`)
- app calls `supabase.auth.setSession(...)` when needed
- `onAuthStateChange` in `supabaseAuthService` receives session and persists immediately

Note: the service now stores a minimal session immediately on `SIGNED_IN`, then enriches from `doctor` table after. This avoids redirect flicker from middleware race conditions.

---

## Where session/user information is stored

## 1) Supabase-managed session (in-memory/client)

Supabase JS maintains current auth session internally and refreshes token based on client config:

- `autoRefreshToken: true`
- `persistSession: true`
- `detectSessionInUrl: false` (URL/hash handling is manual in app pages)

Configured in `app/lib/supabase.ts`.

## 2) App cookies (used by middleware and app)

Set by `setAuthData(...)` and related methods in `supabaseAuthService`:

- `access_token`
- `user` (stringified app user object)
- `refresh_token`

Purpose:

- `middleware.ts` checks `access_token` cookie to allow/deny protected routes.
- client reads `user` for quick auth state hydration.

## 3) localStorage (client fallback/sync)

Also stored:

- `access_token`
- `refresh_token`
- `user`

Purpose:

- recover state if cookies are temporarily missing
- keep client auth state consistent across refreshes

---

## Route protection and redirects

## Public routes

Current public routes in `middleware.ts` include:

- `/login`
- `/signup`
- `/forgot-password`
- `/forgot-reset-password`
- `/callback`

## Protected routes

`middleware.ts` protects:

- `/`
- `/hospital-admin`

If no `access_token` cookie, middleware redirects to `/login?redirect=<original-url>`.

## Auth layout behavior

`app/(pages)/(auth)/layout.tsx` redirects already-authenticated users away from `/login` and `/signup` to app routes (or redirect query if present).

---

## Data model notes

- Public signup currently stores profile fields in Supabase Auth metadata (`raw_user_meta_data`), not in a new profile table.
- Existing admin doctor onboarding API (`app/api/auth/signup/route.ts`) is separate and remains unchanged.
- Existing auth flows still enrich user details from `doctor` table when available.

---

## Environment and Supabase config dependencies

Required for correct behavior:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (recommended for predictable redirect URLs)

Supabase dashboard requirements:

- email auth enabled
- site URL configured
- redirect URL allowlist includes app domains (dev/staging/prod)
- Google provider configured for OAuth (if Google login is used)

---

## Troubleshooting quick checks

- Verification email not received:
  - check Supabase auth email settings/templates/provider limits
- Redirects to login unexpectedly after OAuth:
  - verify `access_token` cookie is being set
  - verify callback/redirect URLs in Supabase allowlist
- User exists but cannot sign up:
  - expected duplicate email behavior; use login or password reset
- User logs in but has missing profile fields:
  - check `raw_user_meta_data` in Supabase auth user record

