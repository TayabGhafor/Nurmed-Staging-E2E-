import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use fallback values during build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { hospitalId, isActive } = await request.json();

    if (!hospitalId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: "Hospital ID and isActive status are required" },
        { status: 400 }
      );
    }

    // Step 1: Deactivate/Activate the hospital
    const { data: hospital, error: hospitalError } = await supabase
      .from("hospital")
      .update({ is_active: isActive })
      .eq("id", hospitalId)
      .select()
      .single();

    if (hospitalError) {
      console.error("Error updating hospital:", hospitalError);
      return NextResponse.json(
        { error: `Failed to update hospital: ${hospitalError.message}` },
        { status: 500 }
      );
    }

    // Step 2: Get all doctors in this hospital
    const { data: doctors, error: doctorsError } = await supabase
      .from("doctor")
      .select("id")
      .eq("hospital_id", hospitalId);

    if (doctorsError) {
      console.error("Error fetching doctors:", doctorsError);
      return NextResponse.json(
        { error: `Failed to fetch doctors: ${doctorsError.message}` },
        { status: 500 }
      );
    }

    // Step 3: Deactivate/Activate all doctors in the hospital
    const doctorUpdatePromises = (doctors || []).map((doctor) =>
      supabase.rpc("deactivate_doctor", {
        p_doctor_id: doctor.id,
        p_is_active: isActive,
      })
    );

    const doctorResults = await Promise.allSettled(doctorUpdatePromises);

    // Check if any doctor updates failed
    const failedDoctors = doctorResults.filter(
      (result) => result.status === "rejected"
    );

    if (failedDoctors.length > 0) {
      console.error("Some doctors failed to update:", failedDoctors);
      return NextResponse.json(
        {
          success: true,
          hospital,
          warning: `Hospital ${isActive ? 'activated' : 'deactivated'}, but ${failedDoctors.length} doctor(s) failed to update`,
          doctorsUpdated: doctors?.length || 0,
          doctorsFailed: failedDoctors.length,
        },
        { status: 207 } // 207 Multi-Status
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Hospital and ${doctors?.length || 0} doctor(s) ${isActive ? 'activated' : 'deactivated'} successfully`,
        hospital,
        doctorsUpdated: doctors?.length || 0,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in deactivate hospital endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

