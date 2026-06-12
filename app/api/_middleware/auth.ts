import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use fallback values during build time to avoid errors
// These will be replaced with actual values at runtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

export const supabaseClient = createClient(supabaseUrl, supabaseKey);

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  user?: any;
  error?: string;
}

export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing Authorization header' };
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (user && !error) {
      return { authenticated: true, userId: user.id, user };
    }
    
    return { authenticated: false, error: error?.message || 'Invalid token' };
  } catch (error: any) {
    return { authenticated: false, error: 'Authentication failed' };
  }
}

export function isAdmin(user: any): boolean {
  const roles = user?.user_metadata?.role || [];
  return roles.includes('superAdmin') || roles.includes('hospitalAdmin');
}

export function hasRole(user: any, role: string): boolean {
  const roles = user?.user_metadata?.role || [];
  return roles.includes(role);
}

export function withAuth(
  handler: (request: NextRequest, auth: AuthResult) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const auth = await authenticateRequest(request);
    
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    
    return handler(request, auth);
  };
}

export function withAdminAuth(
  handler: (request: NextRequest, auth: AuthResult) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const auth = await authenticateRequest(request);
    
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    
    if (!isAdmin(auth.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return handler(request, auth);
  };
}