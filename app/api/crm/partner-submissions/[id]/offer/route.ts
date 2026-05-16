import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: submission } = await supabase
    .from('partner_submissions')
    .select('id,organization_id,deal_id,funding_partner_id,conditions,notes,deals!inner(id,organization_id,requested_amount,approved_amount)')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  const deal = Array.isArray(submission?.deals) ? submission?.deals[0] : submission?.deals;
  if (!submission || !deal) return NextResponse.json({ success: false, error: 'Lender submission not found.' }, { status: 404 });

  const amount = Number(deal.approved_amount || deal.requested_amount || 10000);
  const { data: offer, error } = await supabase
    .from('offers')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      funding_partner_id: submission.funding_partner_id,
      partner_submission_id: submission.id,
      approved_amount: amount,
      factor_rate: 1.35,
      payback_amount: Math.round(amount * 1.35),
      payment_frequency: 'daily',
      daily_payment: Math.round((amount * 1.35) / 120),
      term_days: 120,
      status: 'received',
      stips_required: submission.conditions ? [submission.conditions] : [],
      notes: submission.notes || null,
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      activity_type: 'offer',
      title: 'Offer created from lender response',
      body: `Approved amount initialized at $${amount.toLocaleString()}.`,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'offer_created_from_submission',
      resource_type: 'offers',
      resource_id: offer.id,
      new_data: { partner_submission_id: submission.id, approved_amount: amount },
    }),
  ]);

  return NextResponse.json({ success: true, offerId: offer.id });
}
