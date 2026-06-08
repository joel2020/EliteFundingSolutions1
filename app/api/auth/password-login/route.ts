import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { CRM_ACCESS_ROLES } from '@/lib/access-control';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';
import { requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
}

function withAuthCookies(response: NextResponse, cookiesToSet: Array<{ name: string; value: string; options: any }>) {
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

export async function POST(request: NextRequest) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const cookiesToSet: Array<{ name: string; value: string; options: any }> = [];
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies) {
        cookiesToSet.push(...nextCookies);
      },
    },
  });

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid login request.' }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  if (!email || !password) {
    return NextResponse.json({ success: false, error: 'Email and password are required.' }, { status: 400 });
  }

  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const response = NextResponse.json({ success: false, error: error?.message || 'Login failed.' }, { status: 401 });
    return withAuthCookies(response, cookiesToSet);
  }

  const serviceSupabase = createServiceSupabaseClient();
  const { data: profile, error: profileError } = await serviceSupabase
    .from('user_profiles')
    .select('id,organization_id,email,role,is_active,deleted_at')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (profileError) {
    const response = NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
    return withAuthCookies(response, cookiesToSet);
  }

  if (!profile) {
    await authClient.auth.signOut();
    const response = NextResponse.json({ success: false, error: 'No CRM profile found. Contact admin.' }, { status: 403 });
    return withAuthCookies(response, cookiesToSet);
  }

  if (!profile.is_active || profile.deleted_at) {
    await authClient.auth.signOut();
    const response = NextResponse.json({ success: false, error: 'This account is inactive.' }, { status: 403 });
    return withAuthCookies(response, cookiesToSet);
  }

  if (profile.role !== 'client' && !CRM_ACCESS_ROLES.includes(profile.role as any)) {
    await authClient.auth.signOut();
    const response = NextResponse.json({ success: false, error: 'This account is not authorized for CRM access.' }, { status: 403 });
    return withAuthCookies(response, cookiesToSet);
  }

  const loginAt = new Date().toISOString();
  await serviceSupabase
    .from('user_profiles')
    .update({ last_login_at: loginAt })
    .eq('id', profile.id);

  await serviceSupabase.from('audit_logs').insert({
    organization_id: profile.organization_id || DEFAULT_ORG_ID,
    user_id: data.user.id,
    action: 'login',
    resource_type: 'user_profiles',
    resource_id: profile.id,
    ip_address: clientIp(request),
    user_agent: request.headers.get('user-agent'),
    new_data: { role: profile.role, method: 'password', login_at: loginAt },
  });

  const response = NextResponse.json({
    success: true,
    redirectTo: profile.role === 'client' ? '/portal' : '/crm',
    profile: {
      id: profile.id,
      organization_id: profile.organization_id,
      email: profile.email,
      role: profile.role,
    },
  });
  return withAuthCookies(response, cookiesToSet);
}
