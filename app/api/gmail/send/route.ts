import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/gmail';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { decryptGmailToken } from '@/lib/security';

export const dynamic = 'force-dynamic';
const SEND_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor'];

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
    // Get user's Gmail tokens
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

    // Send email via Gmail
    const result = await sendEmail({
      accessToken: decryptGmailToken(tokens.access_token) || '',
      refreshToken: decryptGmailToken(tokens.refresh_token) || undefined,
      to,
      subject,
      body,
      from: tokens.email,
    });

    // Log email in CRM
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
