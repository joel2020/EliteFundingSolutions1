import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { getOAuth2Client, verifyOAuthState } from '@/lib/gmail';
import { google } from 'googleapis';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { INTERNAL_CRM_ROLES } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

function redirectToSettings(request: NextRequest, errorCode: string) {
  const url = new URL('/crm/settings', request.url);
  url.searchParams.set('gmail_error', errorCode);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const googleError = searchParams.get('error');

    if (googleError) {
      console.error('Google OAuth returned an error:', googleError);
      return redirectToSettings(request, googleError);
    }

    if (!code) {
      return redirectToSettings(request, 'no_code');
    }

    const verifiedState = verifyOAuthState(state);
    if (!verifiedState) {
      return redirectToSettings(request, 'invalid_oauth_state');
    }

    const authClient = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // The callback only needs to read the existing CRM session.
          },
        },
      }
    );

    const { data: { user } } = await authClient.auth.getUser();
    const authenticatedUserId = user?.id || verifiedState.userId;

    if (user?.id && user.id !== verifiedState.userId) {
      return redirectToSettings(request, 'state_user_mismatch');
    }

    if (!authenticatedUserId) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'not_authenticated');
      loginUrl.searchParams.set('next', '/crm/settings');
      return NextResponse.redirect(loginUrl);
    }

    const redirectUri = new URL('/api/gmail/callback', request.nextUrl.origin).toString();
    const oauth2Client = getOAuth2Client({ redirectUri });
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      console.error('Google OAuth did not return an access token:', tokens);
      return redirectToSettings(request, 'missing_access_token');
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) {
      console.error('Google OAuth did not return an email address:', userInfo);
      return redirectToSettings(request, 'missing_google_email');
    }

    const supabase = createServiceSupabaseClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id,role,is_active')
      .eq('user_id', authenticatedUserId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (!profile || !INTERNAL_CRM_ROLES.includes(profile.role as any)) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'forbidden');
      return NextResponse.redirect(loginUrl);
    }

    const { data: existingToken } = await supabase
      .from('gmail_tokens')
      .select('refresh_token')
      .eq('user_id', authenticatedUserId)
      .maybeSingle();

    const { error } = await supabase
      .from('gmail_tokens')
      .upsert({
        user_id: authenticatedUserId,
        email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || existingToken?.refresh_token || null,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scope: tokens.scope,
      });

    if (error) {
      console.error('Error storing Gmail tokens:', error);
      return redirectToSettings(request, 'storage_failed');
    }

    const successUrl = new URL('/crm/settings', request.url);
    successUrl.searchParams.set('gmail', 'connected');
    return NextResponse.redirect(successUrl);
  } catch (error: any) {
    console.error('Gmail callback error:', error);
    return redirectToSettings(request, 'auth_failed');
  }
}
