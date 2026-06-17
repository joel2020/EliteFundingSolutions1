import { NextResponse } from 'next/server';
import { z } from 'zod';
import { INTERNAL_CRM_ROLES, requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Only admins/super-admins/managers can reassign a deal's reps.
const ASSIGN_ROLES = ['super_admin', 'admin', 'manager'];

const assignSchema = z.object({
  assigned_user_id: z.string().uuid().nullable().optional(),
  junior_closer_id: z.string().uuid().nullable().optional(),
  senior_closer_id: z.string().uuid().nullable().optional(),
  iso_broker_id: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(ASSIGN_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = assignSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid assignment payload.' }, { status: 400 });
  }

  const { data: deal, error: loadError } = await supabase
    .from('deals')
    .select('id,organization_id,title,assigned_user_id,junior_closer_id,senior_closer_id,iso_broker_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();
  if (loadError || !deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  // Validate the broker (if provided) belongs to this org.
  if (parsed.data.iso_broker_id) {
    const { data: broker } = await supabase
      .from('iso_brokers')
      .select('id')
      .eq('id', parsed.data.iso_broker_id)
      .eq('organization_id', profile.organization_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!broker) return NextResponse.json({ success: false, error: 'Selected broker is not valid for this organization.' }, { status: 400 });
  }

  // Validate every provided user belongs to this org and is an internal rep.
  const candidateIds = Array.from(new Set(
    [parsed.data.assigned_user_id, parsed.data.junior_closer_id, parsed.data.senior_closer_id]
      .filter((value): value is string => Boolean(value)),
  ));
  if (candidateIds.length) {
    const { data: validUsers } = await supabase
      .from('user_profiles')
      .select('id,role')
      .eq('organization_id', profile.organization_id)
      .is('deleted_at', null)
      .in('id', candidateIds);
    const validIds = new Set((validUsers || []).filter((u: any) => INTERNAL_CRM_ROLES.includes(u.role)).map((u: any) => u.id));
    const invalid = candidateIds.find((id) => !validIds.has(id));
    if (invalid) return NextResponse.json({ success: false, error: 'One or more selected reps are not valid internal users in this organization.' }, { status: 400 });
  }

  const updatePayload: Record<string, string | null> = { updated_by: profile.id };
  if (parsed.data.assigned_user_id !== undefined) updatePayload.assigned_user_id = parsed.data.assigned_user_id;
  if (parsed.data.junior_closer_id !== undefined) updatePayload.junior_closer_id = parsed.data.junior_closer_id;
  if (parsed.data.senior_closer_id !== undefined) updatePayload.senior_closer_id = parsed.data.senior_closer_id;
  if (parsed.data.iso_broker_id !== undefined) updatePayload.iso_broker_id = parsed.data.iso_broker_id;

  const { error: updateError } = await supabase
    .from('deals')
    .update(updatePayload)
    .eq('id', deal.id)
    .eq('organization_id', profile.organization_id);
  if (updateError) return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });

  // Notify the newly assigned broker (in their CRM) so the deal shows up for them.
  const brokerChanged = parsed.data.iso_broker_id && parsed.data.iso_broker_id !== deal.iso_broker_id;
  if (brokerChanged) {
    const { data: brokerProfiles } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('access_entity_type', 'iso_broker')
      .eq('access_entity_id', parsed.data.iso_broker_id)
      .is('deleted_at', null);
    await Promise.allSettled((brokerProfiles || []).map((bp: any) =>
      supabase.from('crm_notifications').insert({
        organization_id: profile.organization_id,
        recipient_user_profile_id: bp.id,
        actor_user_profile_id: profile.id,
        resource_type: 'deals',
        resource_id: deal.id,
        title: 'New deal assigned to you',
        body: `${deal.title || 'A deal'} was routed to you. Open it in your CRM to review.`,
        severity: 'info',
      }),
    ));
  }

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      activity_type: 'status_change',
      title: 'Deal reassigned',
      body: 'Deal rep assignment updated.',
      direction: 'internal',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'deal_reassigned',
      resource_type: 'deals',
      resource_id: deal.id,
      old_data: { assigned_user_id: deal.assigned_user_id, junior_closer_id: deal.junior_closer_id, senior_closer_id: deal.senior_closer_id },
      new_data: updatePayload,
    }),
  ]);

  return NextResponse.json({ success: true });
}
