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
 * POST /api/feature-flags/batch
 * Check multiple features at once for better performance
 * Body: { feature_keys: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user from session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - No active session' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { feature_keys } = body;

    if (!Array.isArray(feature_keys) || feature_keys.length === 0) {
      return NextResponse.json(
        { error: 'feature_keys array is required' },
        { status: 400 }
      );
    }

    // Get all user features at once
    const { data, error } = await supabase.rpc('get_user_features', {
      p_user_id: session.user.id,
    });

    // If feature flag system is not set up yet (tables don't exist), default all to TRUE
    if (error) {
      console.warn('Feature flag system not initialized, defaulting all features to allow access:', error.message);
      const result = feature_keys.reduce((acc: Record<string, boolean>, key: string) => {
        acc[key] = true;
        return acc;
      }, {});
      
      return NextResponse.json({
        features: result,
        count: feature_keys.length,
        fallback: true,
      });
    }

    // Create a map of feature keys to their enabled status
    const featureMap = (data || []).reduce((acc: Record<string, boolean>, feature: any) => {
      acc[feature.feature_key] = feature.is_enabled;
      return acc;
    }, {});

    // Return only the requested features
    const result = feature_keys.reduce((acc: Record<string, boolean>, key: string) => {
      acc[key] = featureMap[key] ?? false;
      return acc;
    }, {});

    return NextResponse.json({
      features: result,
      count: feature_keys.length,
    });
  } catch (error: any) {
    console.error('Unexpected error in feature-flags/batch-check:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

