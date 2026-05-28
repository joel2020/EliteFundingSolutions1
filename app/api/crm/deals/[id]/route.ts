import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep'];

const updateDealSchema = z.object({
  iso_broker_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;
  const { id } = await params;

  const parsed = updateDealSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid deal update payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from('deals')
    .select('id,organization_id,application_id,lead_id,iso_broker_id')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingError) return NextResponse.json({ success: false, error: existingError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const nextBrokerId = parsed.data.iso_broker_id ?? null;
  if (nextBrokerId) {
    const { data: broker, error: brokerError } = await supabase
      .from('iso_brokers')
      .select('id')
      .eq('id', nextBrokerId)
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (brokerError) return NextResponse.json({ success: false, error: brokerError.message }, { status: 500 });
    if (!broker) return NextResponse.json({ success: false, error: 'Broker not found or inactive.' }, { status: 404 });
  }

  const { error: dealError } = await supabase
    .from('deals')
    .update({ iso_broker_id: nextBrokerId, ...(nextBrokerId ? { lead_source: 'iso' } : {}), updated_by: profile.id })
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);

  if (dealError) return NextResponse.json({ success: false, error: dealError.message }, { status: 500 });

  await Promise.allSettled([
    existing.application_id
      ? supabase.from('applications').update({ iso_broker_id: nextBrokerId, ...(nextBrokerId ? { lead_source: 'iso' } : {}), updated_by: profile.id }).eq('id', existing.application_id).eq('organization_id', profile.organization_id)
      : Promise.resolve(),
    existing.lead_id
      ? supabase.from('leads').update({ iso_broker_id: nextBrokerId, ...(nextBrokerId ? { lead_source: 'iso' } : {}), updated_by: profile.id }).eq('id', existing.lead_id).eq('organization_id', profile.organization_id)
      : Promise.resolve(),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: existing.id,
      application_id: existing.application_id,
      lead_id: existing.lead_id,
      activity_type: 'system',
      title: nextBrokerId ? 'Broker assigned to deal' : 'Broker removed from deal',
      body: nextBrokerId ? 'Deal, application, and lead broker assignment were updated.' : 'Broker assignment was removed from the deal.',
      direction: 'internal',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'deal_broker_updated',
      resource_type: 'deals',
      resource_id: existing.id,
      old_data: { iso_broker_id: existing.iso_broker_id },
      new_data: { iso_broker_id: nextBrokerId },
    }),
  ]);

  return NextResponse.json({ success: true });
}
