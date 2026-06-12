import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Use fallback values during build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const resendKey = process.env.RESEND_API_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendKey);

// Generate random password
function generatePassword(length: number = 12): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if doctor exists in DB
    const { data: doctorData, error: doctorError } = await supabase
      .from("doctor")
      .select(
        "id, user_id, first_name, last_name, email, registration_number, department",
      )
      .eq("email", email)
      .single();

    if (doctorError || !doctorData) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    // Generate new password
    const newPassword = generatePassword(12);

    // Update user password in Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      doctorData.user_id,
      { password: newPassword },
    );

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 },
      );
    }

    // Send email with new credentials
    await resend.emails.send({
      from: "team@nurmed.ai",
      to: doctorData.email,
      subject: "Your NurMed Account Password Reset",
      html: `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html dir="ltr" lang="en">
          <head>
            <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
            <meta name="x-apple-disable-message-reformatting" />
          </head>
          <body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;">
            <div style="display: none; overflow: hidden; line-height: 1px; opacity: 0; max-height: 0; max-width: 0;">
              Your Nurmed.ai password has been reset
            </div>
            
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 37.5em; margin: 0 auto; padding: 20px 0 48px">
              <tbody>
                <tr style="width: 100%">
                  <td>
                    <img alt="Nurmed" height="95" src="https://app.nurmed.ai/images/logo.png" 
                         style="display: block; outline: none; border: none; text-decoration: none; margin: 0 auto;" width="125" />
                    
                    <p style="font-size: 16px; line-height: 26px; margin-bottom: 16px; margin-top: 16px;">
                      Hi <strong>${doctorData.first_name} ${doctorData.last_name}</strong>,
                    </p>
                    
                    <p style="font-size: 16px; line-height: 26px; margin-bottom: 16px; margin-top: 16px;">
                      Your password has been reset as requested. Here are your new login credentials:
                    </p>
                    
                    <!-- Account Details Box -->
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <table width="100%" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding: 8px 0; font-size: 16px; line-height: 24px;">
                            <strong>Email:</strong> ${doctorData.email}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; font-size: 16px; line-height: 24px;">
                            <strong>PASSWORD:</strong>  
                            <span style="font-size: 18px; font-weight: bold; margin-left: 6px;">
                              ${newPassword}
                            </span>
                          </td>
                        </tr>
                      </table>
                    </div>
                    
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="text-align: center; margin: 32px 0;">
                      <tbody>
                        <tr>
                          <td>
                            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/login" 
                               style="line-height: 100%; text-decoration: none; display: block; max-width: 100%; background-color: #5f51e8; border-radius: 3px; color: #fff; font-size: 16px; text-align: center; padding: 12px 24px;">
                              <span style="max-width: 100%; display: inline-block; line-height: 120%;">
                                Login to NurMed
                              </span>
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    
                    <p style="font-size: 14px; line-height: 22px; margin: 16px 0; color: #666;">
                      For security reasons, please change your password after your first login.
                    </p>
                    
                    <p style="font-size: 16px; line-height: 26px; margin-bottom: 16px; margin-top: 16px;">
                      Best,<br />Nurmed team
                    </p>
                    
                    <hr style="width: 100%; border: none; border-top: 1px solid #eaeaea; border-color: #cccccc; margin: 20px 0;" />
                    
                    <p style="font-size: 12px; line-height: 18px; margin: 16px 0; color: #8898aa; text-align: center;">
                      If you didn't request this password reset, please contact your system administrator immediately.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `,
      text: `
Hi ${doctorData.first_name} ${doctorData.last_name},

Your password has been reset as requested. Here are your new login credentials:

Department: ${doctorData.department}
Internal Doctor ID: ${doctorData.registration_number}
Email: ${doctorData.email}
New Password: ${newPassword}

Login at: ${process.env.NEXT_PUBLIC_SITE_URL}/login

For security reasons, please change your password after your first login.

Best,
Nurmed team

If you didn't request this password reset, please contact your system administrator immediately.
      `,
    });

    return NextResponse.json({
      message: "Password reset successfully. New credentials sent via email.",
      data: {
        email: doctorData.email,
        name: `${doctorData.first_name} ${doctorData.last_name}`,
      },
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
