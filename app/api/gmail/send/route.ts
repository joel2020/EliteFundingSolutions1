import { NextRequest, NextResponse } from 'next/server';
import { hasRequiredGmailSendScope, sendEmail } from '@/lib/gmail';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
const SEND_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor'];

/** Number of milliseconds before expiry at which we proactively treat the token as expired. */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(SEND_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile } = auth;

  try {
    const { to, subject, body } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();

    const { data: tokens, error: tokensError } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokensError || !tokens) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect your Gmail account first.' },
        { status: 400 }
      );
    }
    if (!hasRequiredGmailSendScope(tokens.scope)) {
      return NextResponse.json(
        {
          error: 'Gmail is connected without send permission. Please reconnect Gmail from Settings and approve email sending.',
          code: 'missing_gmail_send_scope',
        },
        { status: 403 }
      );
    }

    // Guard: if the access token is expired (or expiring within the buffer) and
    // there is no refresh token available, surface a clear re-auth prompt rather
    // than letting the Google API return a silent 401.
    if (tokens.expires_at && !tokens.refresh_token) {
      const expiresAt = new Date(tokens.expires_at).getTime();
      if (Date.now() >= expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
        return NextResponse.json(
          {
            error:
              'Gmail session expired. Please reconnect your Gmail account in Settings.',
            code: 'gmail_token_expired',
          },
          { status: 401 }
        );
      }
    }

    const result = await sendEmail({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      userId: user.id,
      to,
      subject,
      body,
      from: tokens.email,
    });

    await supabase.from('email_logs').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      to_email: to,
      from_email: tokens.email,
      subject,
      body,
      provider: 'gmail',
      status: 'sent',
      external_id: result.id,
    });

    return NextResponse.json({ success: true, messageId: result.id });
  } catch (error: unknown) {
    console.error('Gmail send error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
