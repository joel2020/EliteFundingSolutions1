import { NextResponse } from 'next/server';
import { getPortalApplicationIds, requirePortalProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requirePortalProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const applicationIds = await getPortalApplicationIds(supabase, user, profile.organization_id);
  if (!applicationIds.length) {
    return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
  }

  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select('id,organization_id,deal_id,status,deals!inner(id,application_id,business_id,lead_id,stage_slug)')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  const deal = Array.isArray(offer?.deals) ? offer?.deals[0] : offer?.deals;
  if (offerError || !offer || !deal || !applicationIds.includes(deal.application_id)) {
    return NextResponse.json({ success: false, error: 'Offer not found.' }, { status: 404 });
  }

  if (!['presented', 'received'].includes(offer.status || '')) {
    return NextResponse.json({ success: false, error: 'This offer cannot be accepted.' }, { status: 409 });
  }

  const { error: updateOfferError } = await supabase
    .from('offers')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', offer.id)
    .eq('organization_id', profile.organization_id);

  if (updateOfferError) {
    return NextResponse.json({ success: false, error: updateOfferError.message }, { status: 500 });
  }

  await supabase
    .from('deals')
    .update({ stage_slug: 'contract_sent', updated_by: profile.id })
    .eq('id', offer.deal_id)
    .eq('organization_id', profile.organization_id);

  await Promise.allSettled([
    supabase.from('deal_status_history').insert({
      organization_id: profile.organization_id,
      deal_id: offer.deal_id,
      from_stage: deal.stage_slug,
      to_stage: 'contract_sent',
      changed_by: profile.id,
      notes: 'Client accepted offer in portal.',
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: offer.deal_id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'status_change',
      title: 'Offer accepted',
      body: 'Client accepted the offer in the portal.',
      direction: 'inbound',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'portal_offer_accepted',
      resource_type: 'offers',
      resource_id: offer.id,
      old_data: { status: offer.status, deal_stage: deal.stage_slug },
      new_data: { status: 'accepted', deal_stage: 'contract_sent' },
    }),
  ]);

  return NextResponse.json({ success: true });
}
