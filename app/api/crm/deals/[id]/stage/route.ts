import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateStageTransition } from '@/lib/crm-workflow';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];
const stageSchema = z.object({
  stage_slug: z.string().min(1),
  notes: z.string().optional().default('CRM stage update.'),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = stageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid stage payload.' }, { status: 400 });
  }

  const { data: deal, error: loadError } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,stage_slug,funded_amount,requested_amount')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (loadError || !deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const previousStage = deal.stage_slug || null;
  const nextStage = parsed.data.stage_slug;

  const transition = validateStageTransition({
    fromStage: previousStage,
    toStage: nextStage,
    role: profile.role,
  });

  if (!transition.ok) {
    return NextResponse.json({ success: false, error: transition.error }, { status: 409 });
  }

  const updatePayload: Record<string, any> = {
    stage_slug: nextStage,
    updated_by: profile.id,
  };

  if (nextStage === 'funded') {
    updatePayload.funded_at = new Date().toISOString();
    // The deals_funded_state_check constraint requires a positive funded_amount on funded
    // deals. Backfill it (so the move isn't blocked and finance/commissions have a figure):
    // existing amount -> accepted offer -> most recent offer -> requested amount.
    let fundedAmount = Number(deal.funded_amount || 0);
    if (!(fundedAmount > 0)) {
      const { data: dealOffers } = await supabase
        .from('offers')
        .select('approved_amount,status,created_at')
        .eq('organization_id', profile.organization_id)
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: false });
      const accepted = (dealOffers || []).find((o: any) => o.status === 'accepted');
      fundedAmount = Number(accepted?.approved_amount || (dealOffers || [])[0]?.approved_amount || deal.requested_amount || 0);
    }
    if (!(fundedAmount > 0)) {
      return NextResponse.json({ success: false, error: 'Add an offer or a requested amount on this deal before marking it funded.' }, { status: 400 });
    }
    updatePayload.funded_amount = fundedAmount;
  }
  if (nextStage === 'declined') updatePayload.declined_at = new Date().toISOString();
  if (nextStage === 'defaulted') updatePayload.defaulted_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('deals')
    .update(updatePayload)
    .eq('id', deal.id)
    .eq('organization_id', profile.organization_id);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  await Promise.allSettled([
    supabase.from('deal_status_history').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      from_stage: previousStage,
      to_stage: nextStage,
      changed_by: profile.id,
      notes: parsed.data.notes,
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'status_change',
      title: 'Deal stage updated',
      body: `${previousStage || 'none'} -> ${nextStage}`,
      direction: 'internal',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'deal_stage_updated',
      resource_type: 'deals',
      resource_id: deal.id,
      old_data: { stage_slug: previousStage },
      new_data: { stage_slug: nextStage },
    }),
  ]);

  return NextResponse.json({ success: true });
}
