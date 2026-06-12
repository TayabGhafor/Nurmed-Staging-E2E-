// app/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MAGIC_LINK_STORAGE_KEYS, Loader } from "../../../components";
import { supabase } from "../../../lib/supabase";
import { authService } from "../../../kyClient/auth";
import { hasScribeRole } from "../../../utils/authRoles";

export default function CallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 1) Extract query params BEFORE they get cleared
        const queryParams = new URLSearchParams(window.location.search);
        const doctorId = queryParams.get("doctor_id");
        const mrn = queryParams.get("mrn");
        const template = queryParams.get("template");
        const language = queryParams.get("language");
        const encounterId = queryParams.get("encounter_id");
        const customParams = queryParams.get("params");
        const redirectTo = queryParams.get("redirect_to");
        const code = queryParams.get("code");
        const errorCode = queryParams.get("error");
        const errorDescription = queryParams.get("error_description");

        if (errorCode) {
          setError(errorDescription || "Authentication failed. Please try again.");
          setStatus("error");
          return;
        }

        // Store in sessionStorage for use after auth
        if (doctorId) sessionStorage.setItem(MAGIC_LINK_STORAGE_KEYS.DOCTOR_ID, doctorId);
        if (customParams) {
          try {
            JSON.parse(customParams); // Validate JSON
            sessionStorage.setItem(MAGIC_LINK_STORAGE_KEYS.PARAMS, customParams);
          } catch (e) {
            console.error("Invalid params JSON:", e);
          }
        }
        if (redirectTo) sessionStorage.setItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT, redirectTo);
        
        // Store additional fields as needed
        if (mrn) sessionStorage.setItem("magic_link_mrn", mrn);
        if (template) sessionStorage.setItem("magic_link_template", template);
        if (language) sessionStorage.setItem("magic_link_language", language);
        if (encounterId) sessionStorage.setItem("magic_link_encounter_id", encounterId);

        // 2) Process OAuth callback code (PKCE flow)
        if (code) {
          const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

          if (authError) {
            console.error("OAuth auth error:", authError);
            setError("Authentication failed. Please try again.");
            setStatus("error");
            return;
          }

          if (data.session) {
            const role =
              data.session.user.user_metadata?.role ??
              (data.session.user.app_metadata as { role?: unknown })?.role;
            if (hasScribeRole(role)) {
              await authService.logout();
              setError(
                "Accounts with the scribe role cannot access the NurMed dashboard.",
              );
              setStatus("error");
              return;
            }

            setStatus("success");
            window.history.replaceState(null, "", "/callback");

            const storedRedirect = sessionStorage.getItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT);
            const finalDestination = storedRedirect || "/";

            setTimeout(() => {
              router.replace(finalDestination);
            }, 100);

            return;
          }
        }

        // 3) Process Supabase auth from hash fragment (magic links + implicit OAuth)
        const hash = window.location.hash;
        if (hash) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          const type = hashParams.get("type");

          // Password recovery: send user to reset page with hash intact
          if (type === "recovery") {
            router.replace(`/forgot-reset-password${hash}`);
            return;
          }

          // Invite (e.g. scribe invite): send user to set-password with hash intact
          if (type === "invite" || type === "signup") {
            router.replace(`/set-password${hash}`);
            return;
          }

          if (accessToken && refreshToken) {
            const { data, error: authError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (authError) {
              console.error("Auth error:", authError);
              setError("Authentication failed. Please try again.");
              setStatus("error");
              return;
            }

            if (data.session) {
              const role =
                data.session.user.user_metadata?.role ??
                (data.session.user.app_metadata as { role?: unknown })?.role;
              if (hasScribeRole(role)) {
                await authService.logout();
                setError(
                  "Accounts with the scribe role cannot access the NurMed dashboard.",
                );
                setStatus("error");
                return;
              }

              setStatus("success");
              
              // 3) Clean URL
              window.history.replaceState(null, "", "/callback");

              // 4) Determine final redirect destination
              // Option A: Use redirect_to from params
              // Option B: Build URL from stored params (mrn, template, etc.)
              // Option C: Go to default dashboard
              
              const storedRedirect = sessionStorage.getItem(MAGIC_LINK_STORAGE_KEYS.REDIRECT);
              const storedMrn = sessionStorage.getItem("magic_link_mrn");
              const storedTemplate = sessionStorage.getItem("magic_link_template");
              const storedLanguage = sessionStorage.getItem("magic_link_language");
              const storedEncounterId = sessionStorage.getItem("magic_link_encounter_id");

              // Build the final destination URL based on your app's needs
              let finalDestination = "/"; // Default
              
              if (storedRedirect) {
                finalDestination = storedRedirect;
              } else if (storedMrn && storedTemplate) {
                // Example: redirect to a specific note/session page
                const params = new URLSearchParams();
                if (storedMrn) params.set("mrn", storedMrn);
                if (storedTemplate) params.set("template", storedTemplate);
                if (storedLanguage) params.set("language", storedLanguage);
                if (storedEncounterId) params.set("encounter_id", storedEncounterId);
                finalDestination = `/?${params.toString()}&new=true`;
              }

              // Small delay to ensure session is propagated
              setTimeout(() => {
                router.replace(finalDestination);
              }, 100);
              
              return;
            }
          }
        }

        // No valid auth tokens/code found
        setError("Invalid or expired authentication link.");
        setStatus("error");
        
      } catch (err) {
        console.error("Callback error:", err);
        setError("Something went wrong. Please try again.");
        setStatus("error");
      }
    };

    handleCallback();
  }, [router]);


  // Loading/Processing UI
  if (status === "processing") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="large" text="Authenticating..." />
      </div>
    );
  }

  // Error UI
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <p className="text-red-500 text-lg">{error}</p>
          <button
            onClick={() => router.replace("/login")}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Success (brief flash before redirect)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader size="large" text="Success! Redirecting..." color="#16a34a" />
    </div>
  );
}