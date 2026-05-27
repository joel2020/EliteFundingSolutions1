import { NextResponse } from 'next/server';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,duplicate_of_business_id,title')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const businessIds = Array.from(new Set([deal.business_id, deal.duplicate_of_business_id].filter(Boolean)));
  const { data: linkedDeals } = await supabase
    .from('deals')
    .select('business_id')
    .eq('organization_id', profile.organization_id)
    .in('duplicate_of_business_id', businessIds);
  (linkedDeals || []).forEach((row: any) => row.business_id && businessIds.push(row.business_id));

  const { data: history, error } = await supabase
    .from('merchant_submission_history')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .in('business_id', Array.from(new Set(businessIds)))
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const rows = (history || []).map((row: any, index: number) => ({
    ...row,
    submission_number: row.submission_sequence || index + 1,
    display_name: `${row.dba || row.legal_name || row.title || 'Merchant'} #${row.submission_sequence || index + 1}`,
  }));

  return NextResponse.json({ success: true, history: rows });
}
