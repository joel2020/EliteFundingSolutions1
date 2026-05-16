import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const GMAIL_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(GMAIL_ROLES);
  if ('response' in auth) return auth.response;
  const { user, supabase } = auth;

  const { error } = await supabase
    .from('gmail_tokens')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ success: false, error: 'Unable to disconnect Gmail.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
