import { NextResponse } from 'next/server';
import { getPortalApplicationIds, requirePortalProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requirePortalProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const applicationIds = await getPortalApplicationIds(supabase, user, profile.organization_id);
  if (!applicationIds.length) return NextResponse.json({ success: true, contracts: [] });

  const { data, error } = await supabase
    .from('contracts')
    .select(`
      id,
      deal_id,
      offer_id,
      contract_type,
      status,
      sent_date,
      signed_date,
      storage_path,
      signed_storage_path,
      funded_amount,
      created_at,
      deals!inner(id, application_id, title, businesses(legal_name, dba))
    `)
    .eq('organization_id', profile.organization_id)
    .in('deals.application_id', applicationIds)
    .in('status', ['sent', 'viewed', 'signed', 'funded'])
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const contracts = (data || []).map((contract: any) => {
    const deal = Array.isArray(contract.deals) ? contract.deals[0] : contract.deals;
    const business = Array.isArray(deal?.businesses) ? deal?.businesses[0] : deal?.businesses;

    return {
      id: contract.id,
      deal_id: contract.deal_id,
      offer_id: contract.offer_id,
      contract_type: contract.contract_type,
      status: contract.status,
      sent_date: contract.sent_date,
      signed_date: contract.signed_date,
      funded_amount: contract.funded_amount,
      has_signed_file: Boolean(contract.signed_storage_path),
      business_name: business?.legal_name || business?.dba || deal?.title || 'Funding contract',
    };
  });

  const viewableIds = contracts.filter((contract) => contract.status === 'sent').map((contract) => contract.id);
  if (viewableIds.length) {
    await supabase
      .from('contracts')
      .update({ status: 'viewed' })
      .eq('organization_id', profile.organization_id)
      .in('id', viewableIds);
  }

  return NextResponse.json({
    success: true,
    contracts: contracts.map((contract) => (
      contract.status === 'sent' ? { ...contract, status: 'viewed' } : contract
    )),
  });
}
