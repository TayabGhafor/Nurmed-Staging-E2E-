import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  authenticateRequest,
  hasRole,
  supabaseClient,
} from "../../../_middleware/auth";

const scribeUrl =
  process.env.NEXT_PUBLIC_SCRIBE_URL?.replace(/\/$/, "") ||
  "https://human-scribe.nurmed.ai";

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;

function generatePassword(length: number = 12): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Creates a Supabase auth user for the scribe with a generated password and emails
 * the credentials directly. The user is created with email_confirm:true so GoTrue does
 * not send its built-in invite/recovery email (which uses Supabase SITE_URL).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 },
    );
  }

  const isHospitalAdmin =
    hasRole(auth.user, "hospitalAdmin") || hasRole(auth.user, "superAdmin");
  if (!isHospitalAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const email = emailRaw.toLowerCase();
  const displayName =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "there";

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  if (!resend) {
    return NextResponse.json(
      { error: "Email delivery is not configured (RESEND_API_KEY)" },
      { status: 503 },
    );
  }

  const hospitalId = auth.user.user_metadata?.hospital_id as
    | number
    | undefined;
  const { first_name, last_name } = splitDisplayName(displayName);
  const password = generatePassword(12);

  const { data: createData, error: createError } =
    await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        role: ["scribe"],
        ...(hospitalId != null ? { hospital_id: hospitalId } : {}),
      },
    });

  if (createError) {
    if (isUserAlreadyExistsError(createError)) {
      return NextResponse.json(
        {
          error:
            "This email already has a NurMed account. Use a different email, or remove the existing account first.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: createError.message || "Failed to create the scribe account.",
      },
      { status: 400 },
    );
  }

  const loginUrl = scribeUrl;

  try {
    await resend.emails.send({
      from: "team@nurmed.ai",
      to: email,
      subject: "Your NurMed Scribe account",
      html: credentialsEmailHtml({ displayName, email, password, loginUrl }),
      text: `
Hi ${displayName},

You've been added to NurMed Scribe. Here are your login credentials:

Email: ${email}
Password: ${password}

Login to Scribe: ${loginUrl}

For security, please change your password after your first login.

— NurMed
      `.trim(),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to send invite email";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user_id: createData?.user?.id ?? null });
}

function isUserAlreadyExistsError(
  err: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return (
    m.includes("already") ||
    m.includes("registered") ||
    err.code === "user_already_exists" ||
    err.code === "email_exists"
  );
}

function splitDisplayName(displayName: string): {
  first_name: string;
  last_name: string;
} {
  const t = displayName.trim();
  const i = t.indexOf(" ");
  if (i === -1) {
    return { first_name: t || "Scribe", last_name: "" };
  }
  return {
    first_name: t.slice(0, i),
    last_name: t.slice(i + 1).trim(),
  };
}

function credentialsEmailHtml(opts: {
  displayName: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  const { displayName, email, password, loginUrl } = opts;
  return `
<!DOCTYPE html>
<html dir="ltr" lang="en">
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
  </head>
  <body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width: 37.5em; margin: 0 auto; padding: 20px 0 48px">
      <tr>
        <td>
          <img alt="Nurmed" height="95" src="https://app.nurmed.ai/images/logo.png" style="display: block; margin: 0 auto;" width="125" />
          <p style="font-size: 16px; line-height: 26px; margin: 16px 0;">
            Hi <strong>${escapeHtml(displayName)}</strong>,
          </p>
          <p style="font-size: 16px; line-height: 26px; margin: 16px 0;">
            You've been added to <strong>NurMed</strong> as a scribe. Here are your login credentials:
          </p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 8px 0; font-size: 16px; line-height: 24px;">
                  <strong>Email:</strong> ${escapeHtml(email)}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 16px; line-height: 24px;">
                  <strong>Password:</strong>
                  <span style="font-size: 18px; font-weight: bold; margin-left: 6px;">${escapeHtml(password)}</span>
                </td>
              </tr>
            </table>
          </div>
          <table align="center" width="100%" cellpadding="0" cellspacing="0" style="text-align: center; margin: 32px 0;">
            <tr>
              <td>
                <a href="${escapeHtml(loginUrl)}" style="background-color: #5f51e8; border-radius: 3px; color: #fff; font-size: 16px; padding: 12px 24px; text-decoration: none; display: inline-block;">
                  Login to Scribe
                </a>
              </td>
            </tr>
          </table>
          <p style="font-size: 14px; line-height: 22px; color: #666;">
            For security, please change your password after your first login.
          </p>
          <p style="font-size: 16px; margin-top: 24px;">Best,<br />NurMed team</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
