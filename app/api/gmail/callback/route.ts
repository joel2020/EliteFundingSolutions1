import { NextRequest, NextResponse } from 'next/server';
import { getOAuth2Client } from '@/lib/gmail';
import { supabase } from '@/lib/supabase';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/crm?error=no_code', request.url));
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Get user info from Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Get current user from Supabase auth
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=not_authenticated', request.url));
    }

    // Store tokens in database
    const { error } = await supabase
      .from('gmail_tokens')
      .upsert({
        user_id: user.id,
        email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scope: tokens.scope,
      });

    if (error) {
      console.error('Error storing tokens:', error);
      return NextResponse.redirect(new URL('/crm?error=storage_failed', request.url));
    }

    return NextResponse.redirect(new URL('/crm/settings?gmail=connected', request.url));
  } catch (error: any) {
    console.error('Gmail callback error:', error);
    return NextResponse.redirect(new URL('/crm?error=auth_failed', request.url));
  }
}
