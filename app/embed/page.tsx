"use client";

import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { supabase } from "../lib/supabase";
import { authService } from "../kyClient/auth";
import { hasScribeRole } from "../utils/authRoles";
import { COOKIE_EXPIRES } from "../kyClient/constants";
import { Loader } from "../components";
import { parseHospitalParams, type HospitalParams } from "../utils/hospital-params";

/**
 * Iframe (embed) login page.
 *
 * Loaded by a hospital EHR inside an <iframe> as `…/embed?token=NONCE`. It
 * exchanges the single-use nonce for a Supabase session via the backend
 * (`/auth/embed/exchange`), establishes the session, and routes into the app.
 *
 * Why this exists instead of `/auth/magic-link`: the magic-link flow redirects
 * the browser through Supabase, which sends frame-busting headers and relies on
 * third-party cookies / localStorage that browsers block inside a cross-site
 * iframe — producing an infinite spinner. Here the backend verifies with
 * Supabase server-to-server, so the iframe only ever talks to our own origin.
 *
 * See IFRAME_EMBED_FRONTEND_GUIDE.md.
 */
export default function EmbedLoginPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Signing you in…");
  // Guard against React StrictMode's double-invoke spending the single-use nonce twice.
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("Missing login token. Please reopen Nurmed from your EHR.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/embed/exchange`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          },
        );

        if (!res.ok) {
          setStatus("error");
          // 401 = nonce invalid / expired / already used → the EHR must re-open
          // to mint a fresh link; retrying here cannot help.
          setMessage(
            res.status === 401
              ? "This login link has expired. Please reopen Nurmed from your EHR."
              : "Could not sign you in. Please try again.",
          );
          return;
        }

        const data = await res.json();

        const { data: sessionData, error } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (error) throw error;

        // Scribe accounts may not use the dashboard (parity with /callback).
        const role =
          sessionData.session?.user.user_metadata?.role ??
          (sessionData.session?.user.app_metadata as { role?: unknown })?.role;
        if (hasScribeRole(role)) {
          await authService.logout();
          setStatus("error");
          setMessage(
            "Accounts with the scribe role cannot access the Nurmed dashboard.",
          );
          return;
        }

        // EHR context can arrive two ways: attached to the nonce server-side
        // (data.params, the production path) or appended to the iframe URL by
        // the EHR (handy for testing). Merge them, preferring the server copy.
        const backendParams = (data.params ?? {}) as Record<string, string>;
        const urlParams = parseHospitalParams(
          new URLSearchParams(window.location.search),
        );
        const ctx: HospitalParams = {
          mrn: backendParams.mrn ?? urlParams.mrn,
          template: backendParams.template ?? urlParams.template,
          language: backendParams.language ?? urlParams.language,
          encounterId:
            backendParams.encounter_id ??
            backendParams.encounterId ??
            urlParams.encounterId,
          doctorId:
            backendParams.doctor_id ??
            backendParams.doctorId ??
            urlParams.doctorId,
          new: backendParams.new ?? urlParams.new,
        };

        // Mirror the magic-link flow: also stash in sessionStorage so the
        // dashboard's getHospitalParamsFromUrl() fallback can recover the
        // context if the URL is cleared before it's consumed.
        if (ctx.mrn) sessionStorage.setItem("magic_link_mrn", ctx.mrn);
        if (ctx.template)
          sessionStorage.setItem("magic_link_template", ctx.template);
        if (ctx.language)
          sessionStorage.setItem("magic_link_language", ctx.language);
        if (ctx.encounterId)
          sessionStorage.setItem("magic_link_encounter_id", ctx.encounterId);
        if (ctx.doctorId)
          sessionStorage.setItem("magic_link_doctor_id", ctx.doctorId);

        // The onAuthStateChange listener writes the access_token cookie as
        // SameSite=Lax, which is NOT sent inside a cross-site iframe — so the
        // middleware would bounce us to /login. Re-write it (and refresh_token)
        // as SameSite=None; Secure AFTER the listener has run, so it survives
        // the cross-site navigation into the app. Scoped to the embed flow only.
        setTimeout(() => {
          Cookies.set("access_token", data.access_token, {
            expires: COOKIE_EXPIRES,
            sameSite: "none",
            secure: true,
          });
          Cookies.set("refresh_token", data.refresh_token, {
            expires: COOKIE_EXPIRES,
            sameSite: "none",
            secure: true,
          });

          // Carry EHR context to the dashboard on the query string, mirroring
          // the magic-link redirect_to. `new=true` is what makes the dashboard
          // auto-open the recording modal — isNewHospitalSession() reads the
          // URL, not sessionStorage, so it MUST travel here.
          const dest = new URL("/", window.location.origin);
          if (ctx.new) dest.searchParams.set("new", ctx.new);
          if (ctx.mrn) dest.searchParams.set("mrn", ctx.mrn);
          if (ctx.template) dest.searchParams.set("template", ctx.template);
          if (ctx.language) dest.searchParams.set("language", ctx.language);
          if (ctx.encounterId)
            dest.searchParams.set("encounterId", ctx.encounterId);
          if (ctx.doctorId) dest.searchParams.set("doctorId", ctx.doctorId);
          window.location.replace(dest.pathname + dest.search);
        }, 150);
      } catch (e) {
        console.error("Embed login failed:", e);
        setStatus("error");
        setMessage("Could not sign you in. Please try again.");
      }
    })();
  }, []);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-red-500 text-lg text-center">{message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader size="large" text={message} />
    </div>
  );
}
