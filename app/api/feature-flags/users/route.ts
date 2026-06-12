import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, isAdmin, supabaseClient } from '../../_middleware/auth';


/**
 * GET /api/feature-flags/users?user_id=xxx
 * Get all features and their status for a specific user
 * 
 * Returns UserFeature[] format:
 * {
 *   feature_key: string,
 *   feature_name: string,
 *   is_enabled: boolean,
 *   source: 'user' | 'default'
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    let userId = searchParams.get('user_id');

    // If no user_id provided, use authenticated user's ID
    if (!userId) {
      userId = auth.userId!;
    }

    // Get all features and user's feature flags
    const { data: features, error: featuresError } = await supabaseClient
      .from('feature_flags')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: true });

    // If feature flag system is not set up yet, return empty
    if (featuresError) {
      console.warn('Feature flag system not initialized, returning empty features list:', featuresError.message);
      return NextResponse.json({
        features: [],
        fallback: true,
      });
    }

    // Get user's specific feature flags
    const { data: userFeatures, error: userFeaturesError } = await supabaseClient
      .from('user_feature_flags')
      .select('feature_flag_id, is_enabled')
      .eq('user_id', userId);

    if (userFeaturesError) {
      console.error('Error fetching user features:', userFeaturesError);
    }

    // Map user features to feature IDs
    const userFeatureMap = (userFeatures || []).reduce((acc: any, uf: any) => {
      acc[uf.feature_flag_id] = uf.is_enabled;
      return acc;
    }, {});

    // Transform to UserFeature format (feature_key, feature_name, is_enabled, source)
    const result = features.map((f: any) => ({
      feature_key: f.key,
      feature_name: f.name,
      is_enabled: userFeatureMap[f.id] !== undefined ? userFeatureMap[f.id] : f.is_enabled_by_default,
      source: userFeatureMap[f.id] !== undefined ? 'user' : 'default',
      // Include raw data for admin UI
      id: f.id,
      description: f.description,
      status: f.status,
      user_enabled: userFeatureMap[f.id] !== undefined ? userFeatureMap[f.id] : null
    }));

    return NextResponse.json({ features: result });
  } catch (error: any) {
    console.error('Error in feature-flags/users GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feature-flags/users
 * Update feature flags for a user (requires admin privileges)
 * Body: { user_id, feature_keys: string[] } - array of enabled feature keys
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify the authenticated user has admin privileges
    if (!isAdmin(auth.user)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_id, feature_keys, granted_by } = body;

    if (!user_id || !Array.isArray(feature_keys)) {
      return NextResponse.json(
        { error: 'user_id and feature_keys array are required' },
        { status: 400 }
      );
    }
    
    // Get all feature flags
    const { data: allFeatures, error: featuresError } = await supabaseClient
      .from('feature_flags')
      .select('id, key')
      .eq('status', 'active');

    // If feature flag system is not set up yet, just return success
    if (featuresError) {
      console.warn('Feature flag system not initialized:', featuresError.message);
      return NextResponse.json({ 
        success: true,
        message: 'Feature flags system not initialized yet',
        fallback: true,
      });
    }

    // Delete existing user feature flags
    await supabaseClient
      .from('user_feature_flags')
      .delete()
      .eq('user_id', user_id);

    // Insert new feature flags (only for features in the feature_keys array)
    const featuresToInsert = allFeatures
      .filter((f: any) => feature_keys.includes(f.key))
      .map((f: any) => ({
        user_id,
        feature_flag_id: f.id,
        is_enabled: true,
        granted_by: granted_by || null,
      }));

    // Also insert disabled flags for features NOT in the array
    const disabledFeatures = allFeatures
      .filter((f: any) => !feature_keys.includes(f.key))
      .map((f: any) => ({
        user_id,
        feature_flag_id: f.id,
        is_enabled: false,
        granted_by: granted_by || null,
      }));

    const allFeatureFlags = [...featuresToInsert, ...disabledFeatures];

    if (allFeatureFlags.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('user_feature_flags')
        .insert(allFeatureFlags);

      if (insertError) {
        console.error('Error inserting feature flags:', insertError);
        return NextResponse.json(
          { error: 'Failed to save feature flags' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Feature flags updated successfully'
    });
  } catch (error: any) {
    console.error('Error in feature-flags/users POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

