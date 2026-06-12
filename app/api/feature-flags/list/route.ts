import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, supabaseClient } from '../../_middleware/auth';



/**
 * GET /api/feature-flags/list
 * Get all available feature flags
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
    const status = searchParams.get('status') || 'active';

    // Query feature flags
    let query = supabaseClient
      .from('feature_flags')
      .select('*')
      .order('name', { ascending: true });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    // If feature flag system is not set up yet (tables don't exist), return empty array
    if (error) {
      console.warn('Feature flag system not initialized, returning empty features list:', error.message);
      return NextResponse.json({
        features: [],
        total: 0,
        fallback: true,
      });
    }

    return NextResponse.json({
      features: data || [],
      total: data?.length || 0,
    });
  } catch (error: any) {
    console.error('Unexpected error in feature-flags/list:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

