import { NextResponse } from 'next/server';
import { hasRequiredGmailSendScope } from '@/lib/gmail';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const GMAIL_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

export async function GET() {
  const auth = await requireCrmProfile(GMAIL_ROLES);
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from('gmail_tokens')
    .select('email,access_token,refresh_token,expires_at,scope')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: 'Unable to check Gmail status.' }, { status: 500 });
  }

  const expiresAt = data?.expires_at ? new Date(data.expires_at).getTime() : null;
  const expiredWithoutRefresh = Boolean(expiresAt && Date.now() >= expiresAt && !data?.refresh_token);
  const missingSendScope = Boolean(data?.email && data?.access_token && !hasRequiredGmailSendScope(data?.scope));
  const connected = Boolean(data?.email && data?.access_token && !expiredWithoutRefresh && !missingSendScope);

  return NextResponse.json({
    success: true,
    connected,
    email: data?.email || null,
    needsReconnect: Boolean(data?.email && (expiredWithoutRefresh || missingSendScope)),
    status: connected ? 'connected' : data?.email ? 'reconnect_required' : 'not_connected',
    reason: expiredWithoutRefresh ? 'gmail_token_expired' : missingSendScope ? 'missing_gmail_send_scope' : null,
  });
}
