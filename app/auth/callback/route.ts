import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { DEFAULT_ORG_ID, createServiceSupabaseClient } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

function safeRedirectPath(path: string | null) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/crm';
  return path;
}

function splitName(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL('/login?error=missing_supabase_public_env', request.url));
  }
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeRedirectPath(requestUrl.searchParams.get('next'));
  const response = NextResponse.redirect(new URL(next, request.url));

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_oauth_code', request.url));
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, request.url));
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.redirect(new URL('/login?error=google_login_failed', request.url));
  }

  const serviceSupabase = createServiceSupabaseClient();
  const { firstName, lastName } = splitName(user.user_metadata?.full_name || user.user_metadata?.name);

  const { data: existingProfile, error: existingProfileError } = await serviceSupabase
    .from('user_profiles')
    .select('id,role,is_active,deleted_at')
    .eq('user_id', user.id)
    .eq('organization_id', DEFAULT_ORG_ID)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(existingProfileError.message)}`, request.url));
  }

  if (existingProfile?.deleted_at) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=account_deleted', request.url));
  }

  const profilePayload = {
    user_id: user.id,
    organization_id: DEFAULT_ORG_ID,
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    avatar_url: user.user_metadata?.avatar_url || null,
    last_login_at: new Date().toISOString(),
  };

  const { error: profileError } = existingProfile
    ? await serviceSupabase
      .from('user_profiles')
      .update(profilePayload)
      .eq('id', existingProfile.id)
    : await serviceSupabase
      .from('user_profiles')
      .insert({
        ...profilePayload,
        role: 'client',
        is_active: true,
      });

  if (profileError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(profileError.message)}`, request.url));
  }

  if (existingProfile?.id) {
    await serviceSupabase.from('audit_logs').insert({
      organization_id: DEFAULT_ORG_ID,
      user_id: user.id,
      action: 'login',
      resource_type: 'user_profiles',
      resource_id: existingProfile.id,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
      new_data: { role: existingProfile.role, method: 'oauth', login_at: profilePayload.last_login_at },
    });
  }

  return response;
}
