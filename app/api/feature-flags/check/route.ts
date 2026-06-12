import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use fallback values during build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
);

/**
 * GET /api/feature-flags/check
 * Check if current user has access to a specific feature
 * Query params: feature_key (required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const featureKey = searchParams.get('feature_key');

    if (!featureKey) {
      return NextResponse.json(
        { error: 'feature_key query parameter is required' },
        { status: 400 }
      );
    }

    // Get current user from session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - No active session' },
        { status: 401 }
      );
    }

    // Call the database function to check feature access
    const { data, error } = await supabase.rpc('check_user_feature_access', {
      p_user_id: session.user.id,
      p_feature_key: featureKey,
    });

    // If feature flag system is not set up yet (tables don't exist), default to TRUE
    if (error) {
      console.warn('Feature flag system not initialized, defaulting to allow access:', error.message);
      return NextResponse.json({
        has_access: true,
        feature_key: featureKey,
        fallback: true,
      });
    }

    return NextResponse.json({
      has_access: data ?? false,
      feature_key: featureKey,
    });
  } catch (error: any) {
    console.error('Unexpected error in feature-flags/check:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

