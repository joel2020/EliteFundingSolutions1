import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { getOAuth2Client } from '@/lib/gmail';
import { google } from 'googleapis';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { INTERNAL_CRM_ROLES } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/crm?error=no_code', request.url));
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

    if (!user) {
      return NextResponse.redirect(new URL('/login?error=not_authenticated', request.url));
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const supabase = createServiceSupabaseClient();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id,role,is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (!profile || !INTERNAL_CRM_ROLES.includes(profile.role as any)) {
      return NextResponse.redirect(new URL('/login?error=forbidden', request.url));
    }

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
