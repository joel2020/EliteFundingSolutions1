import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Matches who can add an offer (deal write roles that touch funder terms).
const DELETE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'underwriter'];

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(DELETE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: existing } = await supabase
    .from('offers')
    .select('id,organization_id,deal_id,funding_partner_id,approved_amount,status')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return NextResponse.json({ success: false, error: 'Offer not found.' }, { status: 404 });

  // Soft delete: hides the offer from the CRM but keeps the row so any commission,
  // contract, or stipulation record already linked to it stays intact.
  const { error } = await supabase
    .from('offers')
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id })
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'offer_deleted',
    resource_type: 'offers',
    resource_id: existing.id,
    old_data: { deal_id: existing.deal_id, funding_partner_id: existing.funding_partner_id, approved_amount: existing.approved_amount, status: existing.status },
  }).then(() => null, () => null);

  return NextResponse.json({ success: true });
}
