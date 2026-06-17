import { NextResponse } from 'next/server';
import { generateColdEmail } from '@/lib/crm-cold-email';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep'];

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data: lead } = await supabase
    .from('leads')
    .select('id,first_name,last_name,business_name,legal_name,industry,merchant_type,requested_amount,funding_amount_requested,email')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!lead) return NextResponse.json({ success: false, error: 'Lead not found.' }, { status: 404 });

  const draft = await generateColdEmail(lead);
  return NextResponse.json({ success: true, draft, to: lead.email || null });
}
