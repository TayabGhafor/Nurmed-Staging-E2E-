"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "../../../components";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import * as Yup from "yup";
import { useFormik } from "formik";
import Loader from "../../../components/Loader";
import { supabase } from "../../../lib/supabase";
import { authService } from "../../../kyClient/auth";
import { hasScribeRole } from "../../../utils/authRoles";

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function getDefaultRouteAfterOAuth(roleRaw: unknown): string {
  const roles = Array.isArray(roleRaw)
    ? roleRaw.map(String)
    : roleRaw
      ? [String(roleRaw)]
      : [];
  if (hasScribeRole(roles)) {
    return "/login";
  }
  return roles.includes("hospitalAdmin") ? "/hospital-admin" : "/";
}

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle, isLoading: authLoading } = useAuth();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [oauthCompleting, setOauthCompleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Supabase may return implicit tokens in the hash on any redirect URL (e.g. /login
  // when Site URL or redirect allowlist differs). With detectSessionInUrl: false we must
  // call setSession explicitly — same as /callback for magic links.
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash?.includes("access_token")) return;

    const hashParams = new URLSearchParams(hash.slice(1));
    const type = hashParams.get("type");
    if (type === "recovery") return;

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    let cancelled = false;

    void (async () => {
      setOauthCompleting(true);
      const { data, error: authError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (cancelled) return;

      if (authError || !data.session) {
        setError(authError?.message || "Authentication failed. Please try again.");
        setOauthCompleting(false);
        return;
      }

      const oauthRole =
        data.session.user.user_metadata?.role ??
        (data.session.user.app_metadata as { role?: unknown })?.role;
      if (hasScribeRole(oauthRole)) {
        await authService.logout();
        setError(
          "Accounts with the scribe role cannot access the NurMed dashboard.",
        );
        setOauthCompleting(false);
        return;
      }

      const path = window.location.pathname;
      const search = window.location.search;
      window.history.replaceState(null, "", path + search);

      const redirectParam = new URLSearchParams(search).get("redirect");
      const meta = data.session.user.user_metadata ?? {};
      const app = data.session.user.app_metadata ?? {};
      const defaultRoute = getDefaultRouteAfterOAuth(
        (meta as { role?: unknown }).role ?? (app as { role?: unknown }).role,
      );

      if (redirectParam) {
        try {
          if (redirectParam.startsWith("http://") || redirectParam.startsWith("https://")) {
            window.location.href = redirectParam;
            return;
          }
          if (redirectParam.startsWith("/")) {
            router.replace(redirectParam);
            return;
          }
        } catch {
          /* fall through */
        }
      }

      router.replace(defaultRoute);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {

    

    // Check for account creation message
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    if (message === 'account_created') {
      setError("Your account has been created! Please check your email for your login credentials.");
      // Clean up URL but preserve redirect parameter
      const redirect = urlParams.get('redirect');
      const currentUrl = window.location.href;

      // Only update URL if it actually needs to change
      const expectedUrl = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login';
      const currentPath = window.location.pathname + window.location.search;

      if (currentPath !== expectedUrl) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const newUrl = new URL('/login', siteUrl);
        if (redirect) {
          newUrl.searchParams.set('redirect', redirect);
        }
        router.replace(newUrl.toString(), { scroll: false });
      }
    }
  }, []); // Remove router from dependencies to prevent re-renders

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .matches(emailRegex, "Please enter a valid email address.")
        .required("Email is required."),
      password: Yup.string()
        .min(6, "Password must be at least 6 characters long.")
        .required("Password is required."),
    }),
    validateOnBlur: true,
    validateOnChange: false, // Disable real-time validation to prevent re-renders
    onSubmit: async (data) => {
      setError("");
      setIsLoading(true);

      const response = await login(data.email, data.password);
      
      if (!response.success) {
        console.log("Login error:", response.error);
        setError(response.error || "Failed to login");
      }
      // Note: Redirect logic is now handled in AuthContext.login()
      // It will redirect to dashboard with hospital parameters if they exist
      
      setIsLoading(false);
    },
  });

  const handleGoogleLogin = async () => {
    setError("");
    setIsGoogleLoading(true);

    const redirectTo = searchParams.get("redirect") || undefined;
    const response = await loginWithGoogle(redirectTo);

    if (!response.success) {
      setError(response.error || "Failed to start Google sign-in");
      setIsGoogleLoading(false);
    }
    // On success the browser will redirect to Google, so we do not reset loading.
  };

  if (oauthCompleting) {
    return (
      <div className="flex min-h-[280px] w-full max-w-[580px] flex-col items-center justify-center rounded-[10px] bg-white p-8 shadow-lg">
        <Loader size="large" text="Signing you in..." />
      </div>
    );
  }

  return (
    <div className="lg:px-22 w-full max-w-[580px] rounded-[10px] bg-white p-8 shadow-lg lg:py-12">
      <div className="mb-8 flex justify-center">
        <Image
          src="/images/logo.png"
          alt="NurMed Logo"
          width={120}
          height={40}
          priority
        />
      </div>

      <h2 className="mb-8 text-center text-[16px] font-normal text-gray-600">
        Fill your Details & Login
      </h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

   

      <form onSubmit={formik.handleSubmit} className="space-y-5">
        <div>
          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            disabled={isLoading || authLoading}
            className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
          />
          {formik.touched.email && formik.errors.email && (
            <div className="mt-1 text-sm text-red-600">
              {formik.errors.email}
            </div>
          )}
        </div>

        <div>
          <div className="relative">
            <input
              value={formik.values.password}
              name="password"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full rounded-md border border-gray-200 px-4 py-3 text-[15px] focus:outline-none"
              disabled={isLoading || authLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
            </button>
          </div>
          {formik.touched.password && formik.errors.password && (
            <div className="mt-1 text-sm text-red-600">
              {formik.errors.password}
            </div>
          )}
        </div>

        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Forgot Password?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full rounded-md bg-[#2832A8] py-3 text-[15px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading || authLoading}
        >
          {isLoading ? "Logging in..." : "Login"}
        </Button>
      </form>
      {/* <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading || authLoading || isGoogleLoading}
        className="mt-4 flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-3 text-[15px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.51 5.51 0 01-2.4 3.62v3h3.88c2.27-2.09 3.56-5.18 3.56-8.65z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.47 1.15-4.07 1.15-3.13 0-5.79-2.11-6.74-4.96h-4v3.12A12 12 0 0012 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.26 14.29A7.2 7.2 0 014.88 12c0-.8.14-1.58.38-2.29V6.6h-4A12 12 0 000 12c0 1.94.46 3.78 1.26 5.4l4-3.11z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.76 0 3.33.61 4.57 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 001.26 6.6l4 3.11c.95-2.85 3.61-4.96 6.74-4.96z"
          />
        </svg>
        {isGoogleLoading ? "Redirecting to Google..." : "Continue with Google"}
      </button>
      <div className="mt-5 text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-[#2832A8] hover:underline">
          Sign up
        </Link>
      </div> */}
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FF]">
        <Loader size="large" />
      </div>
    }>
      <LoginPage />
    </Suspense>
  );
}
