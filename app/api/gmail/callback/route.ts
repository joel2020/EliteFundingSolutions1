import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { getOAuth2Client, hasRequiredGmailSendScope, verifyOAuthState } from '@/lib/gmail';
import { google } from 'googleapis';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { INTERNAL_CRM_ROLES } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

function getCrmOrigin(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_CRM_URL) return process.env.NEXT_PUBLIC_CRM_URL.replace(/\/$/, '');
  if (process.env.CRM_APP_URL) return process.env.CRM_APP_URL.replace(/\/$/, '');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    const url = new URL(appUrl);
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.replace(/^www\./, 'crm.');
      return url.origin;
    }
  }

  return request.nextUrl.origin;
}

function redirectToSettings(request: NextRequest, errorCode: string) {
  const url = new URL('/crm/settings', getCrmOrigin(request));
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

    const verifiedUserId = verifyOAuthState(state);
    if (!verifiedUserId) {
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

    // Require a live CRM session — do not complete the OAuth flow on a state token alone.
    if (!user?.id) {
      const loginUrl = new URL('/login', getCrmOrigin(request));
      loginUrl.searchParams.set('error', 'not_authenticated');
      loginUrl.searchParams.set('redirectTo', '/crm/settings');
      return NextResponse.redirect(loginUrl);
    }

    if (user.id !== verifiedUserId) {
      return redirectToSettings(request, 'state_user_mismatch');
    }

    const authenticatedUserId = user.id;

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      console.error('Google OAuth did not return an access token:', tokens);
      return redirectToSettings(request, 'missing_access_token');
    }
    if (!hasRequiredGmailSendScope(tokens.scope)) {
      console.error('Google OAuth did not grant Gmail send scope:', tokens.scope);
      return redirectToSettings(request, 'missing_gmail_send_scope');
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
      const loginUrl = new URL('/login', getCrmOrigin(request));
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

    const successUrl = new URL('/crm/settings', getCrmOrigin(request));
    successUrl.searchParams.set('gmail', 'connected');
    return NextResponse.redirect(successUrl);
  } catch (error: any) {
    console.error('Gmail callback error:', error);
    return redirectToSettings(request, 'auth_failed');
  }
}
