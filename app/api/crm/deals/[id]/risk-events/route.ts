import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'processor', 'underwriter'];

const riskSchema = z.object({
  event_type: z.enum(['funded', 'defaulted', 'closed_not_funded', 'clawback', 'risk_note']),
  funding_partner_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().default(''),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = riskSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid risk event.', issues: parsed.error.flatten() }, { status: 400 });

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,stage_slug,funded_amount')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const eventDate = new Date().toISOString();
  const { data: event, error } = await supabase
    .from('deal_risk_events')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      business_id: deal.business_id,
      funding_partner_id: parsed.data.funding_partner_id || null,
      event_type: parsed.data.event_type,
      event_date: eventDate,
      amount: parsed.data.amount ?? null,
      notes: parsed.data.notes || null,
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const dealUpdates: Record<string, any> = { updated_by: profile.id };
  if (parsed.data.event_type === 'defaulted') {
    dealUpdates.defaulted_at = eventDate;
    dealUpdates.default_reason = parsed.data.notes || null;
    if (parsed.data.amount != null) dealUpdates.commission_clawback_amount = parsed.data.amount;
  }
  if (parsed.data.event_type === 'funded') {
    dealUpdates.stage_slug = 'funded';
    dealUpdates.funded_at = eventDate;
    if (parsed.data.amount != null) dealUpdates.funded_amount = parsed.data.amount;
  }
  if (parsed.data.event_type === 'closed_not_funded') {
    dealUpdates.stage_slug = 'lost_unresponsive';
  }

  await supabase.from('deals').update(dealUpdates).eq('id', deal.id).eq('organization_id', profile.organization_id);

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: parsed.data.event_type === 'funded' ? 'deal_funded' : 'status_change',
      title: `Risk event recorded: ${parsed.data.event_type.replaceAll('_', ' ')}`,
      body: parsed.data.notes || null,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'deal_risk_event_created',
      resource_type: 'deal_risk_events',
      resource_id: event.id,
      new_data: parsed.data,
    }),
  ]);

  return NextResponse.json({ success: true, eventId: event.id });
}
