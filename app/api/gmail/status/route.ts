import { NextResponse } from 'next/server';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const GMAIL_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

export async function GET() {
  const auth = await requireCrmProfile(GMAIL_ROLES);
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from('gmail_tokens')
    .select('email')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: 'Unable to check Gmail status.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    connected: Boolean(data?.email),
    email: data?.email || null,
  });
}
