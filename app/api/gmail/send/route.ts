import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { sendEmail } from '@/lib/gmail';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  try {
    const { to, subject, body } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, body' },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* route does not mutate auth cookies */ },
      },
    });
    const { data: { session } } = await authClient.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = createServiceSupabaseClient();
    // Get user's Gmail tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('user_id', session.user.id)
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
      user_id: session.user.id,
      to_email: to,
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
