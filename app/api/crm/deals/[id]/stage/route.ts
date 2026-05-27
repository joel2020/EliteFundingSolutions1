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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select('id,organization_id,business_id,application_id,lead_id,stage_slug,funded_amount')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (loadError || !deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const previousStage = deal.stage_slug || null;
  const nextStage = parsed.data.stage_slug;

  const [{ count: acceptedOfferCount }, { count: openRequiredDocumentCount }] = await Promise.all([
    supabase
      .from('offers')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .eq('deal_id', deal.id)
      .eq('status', 'accepted'),
    supabase
      .from('document_requests')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .eq('deal_id', deal.id)
      .eq('required', true)
      .not('status', 'in', '(approved,waived)'),
  ]);

  const transition = validateStageTransition({
    fromStage: previousStage,
    toStage: nextStage,
    role: profile.role,
    acceptedOfferCount: acceptedOfferCount || 0,
    openRequiredDocumentCount: openRequiredDocumentCount || 0,
    fundedAmount: Number(deal.funded_amount || 0),
  });

  if (!transition.ok) {
    return NextResponse.json({ success: false, error: transition.error }, { status: 409 });
  }

  const updatePayload: Record<string, string | null> = {
    stage_slug: nextStage,
    updated_by: profile.id,
  };

  if (nextStage === 'funded') updatePayload.funded_at = new Date().toISOString();
  if (nextStage === 'declined') updatePayload.declined_at = new Date().toISOString();

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
