import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

function getCorsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin");
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowOrigin =
    origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))
      ? origin
      : allowedOrigins[0] || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, X-Requested-With, Accept, Origin",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// Create Supabase client with service role key for admin operations
// Use fallback values during build time
let supabase: any;
let resend: any;

try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
  console.error("Failed to initialize Supabase client:", error);
}

try {
  // Initialize Resend
  const resendKey = process.env.RESEND_API_KEY || 'placeholder-key';
  resend = new Resend(resendKey);
} catch (error) {
  console.error("Failed to initialize Resend client:", error);
}

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

// Generate hospital initials from hospital name
function generateHospitalInitials(hospitalName: string): string {
  if (!hospitalName) return "HOS";
  
  // Split by spaces and take first letter of each word
  const words = hospitalName.trim().split(/\s+/);
  const initials = words
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3); // Take max 3 characters
  
  return initials || "HOS"; // Fallback to "HOS" if no valid initials
}

// Generate unique registration number
async function generateRegistrationNumber(hospitalId: number, supabase: any): Promise<string> {
  // First, get the hospital name
  const { data: hospitalData, error: hospitalError } = await supabase
    .from('hospital')
    .select('name')
    .eq('id', hospitalId)
    .single();

  if (hospitalError) {
    console.error("Error fetching hospital:", hospitalError);
    throw new Error("Failed to fetch hospital information");
  }

  const hospitalName = hospitalData?.name || "Hospital";
  const initials = generateHospitalInitials(hospitalName);
  
  let registrationNumber: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // Generate 6-digit random number
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    registrationNumber = `${initials}${randomNumber}`;
    
    // Check if this registration number already exists
    const { data: existingDoctor, error: checkError } = await supabase
      .from("doctor")
      .select("registration_number")
      .eq("registration_number", registrationNumber)
      .single();

    if (checkError && checkError.code === "PGRST116") {
      // PGRST116 means no rows found, which means it's unique
      isUnique = true;
    } else if (checkError) {
      console.error("Error checking registration number uniqueness:", checkError);
      throw new Error("Failed to check registration number uniqueness");
    }
    
    attempts++;
  }

  if (!isUnique) {
    throw new Error("Failed to generate unique registration number after multiple attempts");
  }

  return registrationNumber!;
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  // Check required environment variables
  const requiredEnvVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  };

  const missingEnvVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key);

  if (missingEnvVars.length > 0) {
    console.error("Missing environment variables:", missingEnvVars);
    return NextResponse.json(
      {
        error: `Server configuration error: Missing environment variables: ${missingEnvVars.join(", ")}`,
        missingVars: missingEnvVars
      },
      { status: 500, headers: corsHeaders }
    );
  }

  // Check if clients are properly initialized
  if (!supabase) {
    console.error("Supabase client not initialized");
    return NextResponse.json(
      { error: "Supabase client initialization failed" },
      { status: 500, headers: corsHeaders }
    );
  }

  if (!resend) {
    console.error("Resend client not initialized");
    return NextResponse.json(
      { error: "Email service initialization failed" },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    console.log("Received signup request body:", body);
    
    const {
      email,
      first_name,
      sur_name,
      last_name,
      department,
      speciality, // Optional
      hospital_id,
      location_id, // Optional
      role, // Can be string or string[]
      registration_number,
    } = body;

    // Validate required fields
    const missingFields = [];
    if (!email) missingFields.push("email");
    if (!first_name) missingFields.push("first_name");
    if (!last_name) missingFields.push("last_name");
    if (!department) missingFields.push("department");
    if (!hospital_id) missingFields.push("hospital_id");
    // This is evercare lahore hospital id
    const requiresInternalDoctorId =
      Number(hospital_id) === Number(process.env.NEXT_PUBLIC_EVERCARE_LAHORE_HOSPITAL_ID);
    if (
      requiresInternalDoctorId &&
      (!registration_number || !String(registration_number).trim())
    ) {
      missingFields.push("registration_number");
    }
    
    if (missingFields.length > 0) {
      console.log("Missing required fields:", missingFields);
      console.log("Field values:", { email, first_name, last_name, department, hospital_id });
      return NextResponse.json(
        {
          error: `Missing required fields: ${missingFields.join(", ")}`,
        },
        { status: 400, headers: corsHeaders },
      );
    }

    // Normalize role to array and validate
    let roleArray: string[];
    if (!role) {
      roleArray = ["doctor"]; // Default to doctor
    } else if (Array.isArray(role)) {
      roleArray = role;
    } else {
      roleArray = [role]; // Convert single string to array
    }

    // Validate all roles
    const validRoles = ["doctor", "hospitalAdmin", "superAdmin"];
    const invalidRoles = roleArray.filter(r => !validRoles.includes(r));
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: `Invalid roles: ${invalidRoles.join(", ")}. Must be one of: doctor, hospitalAdmin, superAdmin` },
        { status: 400, headers: corsHeaders },
      );
    }

    // Ensure at least one role
    if (roleArray.length === 0) {
      roleArray = ["doctor"];
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400, headers: corsHeaders },
      );
    }

    let finalRegistrationNumber: string;
    if (registration_number && String(registration_number).trim() !== "") {
      finalRegistrationNumber = String(registration_number).trim();

      const { data: existingDoctor, error: checkError } = await supabase
        .from("doctor")
        .select("registration_number")
        .eq("registration_number", finalRegistrationNumber)
        .single();

      if (checkError && checkError.code === "PGRST116") {
        // PGRST116 means no rows found, which means it's unique - proceed
      } else if (checkError) {
        console.error("Error checking registration number uniqueness:", checkError);
        return NextResponse.json(
          { error: "Failed to validate Internal Doctor ID" },
          { status: 500, headers: corsHeaders },
        );
      } else {
        return NextResponse.json(
          { error: "A doctor with this Internal Doctor ID already exists" },
          { status: 409, headers: corsHeaders },
        );
      }
    } else {
      finalRegistrationNumber = await generateRegistrationNumber(
        hospital_id,
        supabase,
      );
    }

    // Generate random password
    const temporaryPassword = generatePassword(12);

    // Create user directly with password
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name,
          sur_name: sur_name || "",
          last_name,
          registration_number: finalRegistrationNumber,
          department,
          ...(speciality ? { speciality } : {}),
          hospital_id,
          role: roleArray, // Store as array
        },
      });

    if (createError) {
      console.error("Error creating user:", createError);
      // Handle duplicate email (Supabase may return different messages)
      const isDuplicateEmail =
        createError.message?.toLowerCase().includes("already") ||
        createError.message?.toLowerCase().includes("already registered") ||
        createError.code === "user_already_exists";
      if (isDuplicateEmail) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 409, headers: corsHeaders },
        );
      }
      return NextResponse.json(
        { error: `Failed to create user: ${createError.message}` },
        { status: 500, headers: corsHeaders },
      );
    }

    // Supabase may return success with empty identities when email already exists
    if (userData.user && (!userData.user.identities || userData.user.identities.length === 0)) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409, headers: corsHeaders },
      );
    }

    // Create doctor profile
    const { error: doctorError } = await supabase.from("doctor").insert({
      user_id: userData.user.id,
      email: email,
      first_name: first_name,
      sur_name: sur_name || "",
      last_name: last_name,
      registration_number: finalRegistrationNumber,
      department: department,
      ...(speciality ? { speciality } : {}),
      hospital_id: hospital_id,
      ...(location_id != null && { location_id }),
      phone_number: "",
      is_active: true,
      role: roleArray, // Store as array
    });

    if (doctorError) {
      console.error("Error creating doctor profile:", doctorError);

      // If it's a duplicate registration number error, delete the user and return error
      if (doctorError.code === '23505' && doctorError.message.includes('registration_number')) {
        // Delete the user that was just created
        await supabase.auth.admin.deleteUser(userData.user.id);
        return NextResponse.json(
          { error: "A doctor with this registration number already exists" },
          { status: 409, headers: corsHeaders },
        );
      }

      // For other errors, still delete the user to maintain consistency
      await supabase.auth.admin.deleteUser(userData.user.id);
      return NextResponse.json(
        { error: `Failed to create doctor profile: ${doctorError.message}` },
        { status: 500, headers: corsHeaders },
      );
    }

    try {
      await resend.emails.send({
        from: "team@nurmed.ai",
        to: email,
        subject: "Your NurMed Account Credentials",
        html: `
          <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html dir="ltr" lang="en">
            <head>
              <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
              <meta name="x-apple-disable-message-reformatting" />
            </head>
            <body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;">
              <div style="display: none; overflow: hidden; line-height: 1px; opacity: 0; max-height: 0; max-width: 0;">
                Welcome to Nurmed.ai - Your account credentials
              </div>
              
              <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 37.5em; margin: 0 auto; padding: 20px 0 48px">
                <tbody>
                  <tr style="width: 100%">
                    <td>
                      <img alt="Nurmed" height="95" src="https://app.nurmed.ai/images/logo.png" 
                           style="display: block; outline: none; border: none; text-decoration: none; margin: 0 auto;" width="125" />
                      
                      <p style="font-size: 16px; line-height: 26px; margin-bottom: 16px; margin-top: 16px;">
                        Hi <strong>${first_name} ${last_name}</strong>,
                      </p>
                      
                      <p style="font-size: 16px; line-height: 26px; margin-bottom: 16px; margin-top: 16px;">
                        Welcome to Nurmed.ai! Your account has been created successfully. Here are your login credentials:
                      </p>
                      
                      <!-- Account Details Box -->
                      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <table width="100%" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding: 8px 0; font-size: 16px; line-height: 24px;">
                              <strong>Email:</strong> ${email}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-size: 16px; line-height: 24px;">
                              <strong>PASSWORD:</strong>  
                              <span style="font-size: 18px; font-weight: bold; margin-left: 6px;">
                                ${temporaryPassword}
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
                        If you have any issues, please contact your system administrator.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </body>
          </html>
        `,
        text: `
Welcome to Nurmed.ai!

Hi ${first_name} ${last_name},

Your account has been created successfully. Here are your login credentials:

Department: ${department}
Registration Number: ${finalRegistrationNumber}
Email: ${email}
Password: ${temporaryPassword}

Login at: ${process.env.NEXT_PUBLIC_SITE_URL}/login

For security reasons, please change your password after your first login.

Best,
Nurmed team

If you have any issues, please contact your system administrator.
        `,
      });

    } catch (emailError) {
      console.error("❌ Failed to send credentials email:", emailError);
      console.error(
        "❌ Full error details:",
        JSON.stringify(emailError, null, 2),
      );
      // Don't fail the operation - admin can manually provide credentials
    }

    return NextResponse.json(
      {
        message:
          "User created successfully. Login credentials have been sent to the provided email address.",
        user_id: userData.user.id,
        data: {
          email,
          name: `${first_name} ${last_name}`,
          department,
          registration_number: finalRegistrationNumber,
          role: roleArray,
          created_at: new Date().toISOString(),
        },
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    console.error("Unexpected error in signup:", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);

    // Return more detailed error information for debugging
    return NextResponse.json(
      {
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500, headers: corsHeaders },
    );
  }
}