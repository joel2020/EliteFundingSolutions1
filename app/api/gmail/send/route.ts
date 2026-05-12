import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

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
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      to,
      subject,
      body,
      from: tokens.email,
    });

    // Log email in CRM
    await supabase.from('email_logs').insert({
      user_id: user.id,
      to_email: to,
      subject,
      body,
      provider: 'gmail',
      status: 'sent',
      external_id: result.id,
    });

    return NextResponse.json({ success: true, messageId: result.id });
  } catch (error: any) {
    console.error('Gmail send error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
