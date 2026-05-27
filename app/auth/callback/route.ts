import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { DEFAULT_ORG_ID, createServiceSupabaseClient } from '@/lib/server-supabase';
import { isInternalCrmRole, safeRedirectPath } from '@/lib/auth-routing';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

function splitName(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeRedirectPath(requestUrl.searchParams.get('next'), '/crm');
  const response = NextResponse.redirect(new URL(next, request.url));

  if (!code) {
    const authError = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');
    const error = authError || 'missing_oauth_code';
    console.warn('[auth callback] missing code', { error });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
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
    console.warn('[auth callback] code exchange failed', { error: exchangeError.message });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, request.url));
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    console.warn('[auth callback] user load failed', { error: userError?.message || 'missing_user_email' });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(userError?.message || 'google_login_failed')}`, request.url));
  }

  const serviceSupabase = createServiceSupabaseClient();
  const { firstName, lastName } = splitName(user.user_metadata?.full_name || user.user_metadata?.name);

  const { data: existingProfile, error: existingProfileError } = await serviceSupabase
    .from('user_profiles')
    .select('id,role,is_active')
    .eq('user_id', user.id)
    .eq('organization_id', DEFAULT_ORG_ID)
    .maybeSingle();

  if (existingProfileError) {
    console.warn('[auth callback] profile lookup failed', { userId: user.id, error: existingProfileError.message });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(existingProfileError.message)}`, request.url));
  }

  const { data: emailOnlyProfile, error: emailOnlyProfileError } = !existingProfile
    ? await serviceSupabase
      .from('user_profiles')
      .select('id,role,is_active')
      .eq('email', user.email)
      .eq('organization_id', DEFAULT_ORG_ID)
      .is('user_id', null)
      .maybeSingle()
    : { data: null, error: null };

  if (emailOnlyProfileError) {
    console.warn('[auth callback] email profile lookup failed', { userId: user.id, error: emailOnlyProfileError.message });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(emailOnlyProfileError.message)}`, request.url));
  }

  const profileToUpdate = existingProfile || emailOnlyProfile;
  const isCrmDestination = next === '/crm' || next.startsWith('/crm/');

  if (!profileToUpdate && isCrmDestination) {
    console.warn('[auth callback] CRM access missing profile', { userId: user.id, email: user.email });
    return NextResponse.redirect(new URL('/access-denied?reason=access_not_configured', request.url));
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

  const { data: savedProfile, error: profileError } = profileToUpdate
    ? await serviceSupabase
      .from('user_profiles')
      .update(profilePayload)
      .eq('id', profileToUpdate.id)
      .select('id,role,is_active')
      .single()
    : await serviceSupabase
      .from('user_profiles')
      .insert({
        ...profilePayload,
        role: 'client',
        is_active: true,
      })
      .select('id,role,is_active')
      .single();

  if (profileError) {
    console.warn('[auth callback] profile upsert failed', { userId: user.id, error: profileError.message });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(profileError.message)}`, request.url));
  }

  if (!savedProfile?.is_active) {
    return NextResponse.redirect(new URL('/access-denied?reason=account_inactive', request.url));
  }

  if (isCrmDestination && !isInternalCrmRole(savedProfile?.role)) {
    return NextResponse.redirect(new URL('/access-denied?reason=crm_access_denied', request.url));
  }

  return response;
}
