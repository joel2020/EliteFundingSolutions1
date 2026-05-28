import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep'];
const ASSIGNMENT_ROLES = ['super_admin', 'admin'];

const updateDealSchema = z.object({
  iso_broker_id: z.string().uuid().nullable().optional(),
  assigned_user_id: z.string().uuid().nullable().optional(),
  junior_closer_id: z.string().uuid().nullable().optional(),
  senior_closer_id: z.string().uuid().nullable().optional(),
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

  const brokerTouched = Object.prototype.hasOwnProperty.call(parsed.data, 'iso_broker_id');
  const assignmentFields = ['assigned_user_id', 'junior_closer_id', 'senior_closer_id'] as const;
  const assignmentTouched = assignmentFields.some((field) => Object.prototype.hasOwnProperty.call(parsed.data, field));
  const canAssign = ASSIGNMENT_ROLES.includes(profile.role) || (profile.role === 'manager' && Array.isArray(profile.permissions) && profile.permissions.includes('assign_deals'));

  if (assignmentTouched && !canAssign) {
    return NextResponse.json({ success: false, error: 'Only admins and permitted managers can change deal rep assignments.' }, { status: 403 });
  }
  if (!brokerTouched && !assignmentTouched) {
    return NextResponse.json({ success: false, error: 'No supported deal fields were provided.' }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from('deals')
    .select('id,organization_id,application_id,lead_id,iso_broker_id,assigned_user_id,junior_closer_id,senior_closer_id')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existingError) return NextResponse.json({ success: false, error: existingError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const nextBrokerId = brokerTouched ? parsed.data.iso_broker_id ?? null : existing.iso_broker_id;
  if (brokerTouched && nextBrokerId) {
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

  const assignmentIds = assignmentFields
    .map((field) => parsed.data[field])
    .filter((value): value is string => Boolean(value));

  if (assignmentIds.length) {
    const uniqueAssignmentIds = Array.from(new Set(assignmentIds));
    const { data: assignmentUsers, error: assignmentError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('is_active', true)
      .neq('role', 'client')
      .in('id', uniqueAssignmentIds);

    if (assignmentError) return NextResponse.json({ success: false, error: assignmentError.message }, { status: 500 });
    if ((assignmentUsers || []).length !== uniqueAssignmentIds.length) {
      return NextResponse.json({ success: false, error: 'One or more selected reps are inactive or unavailable.' }, { status: 404 });
    }
  }

  const dealUpdate: Record<string, string | null> = { updated_by: profile.id };
  if (brokerTouched) {
    dealUpdate.iso_broker_id = nextBrokerId;
    if (nextBrokerId) dealUpdate.lead_source = 'iso';
  }
  assignmentFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(parsed.data, field)) {
      dealUpdate[field] = parsed.data[field] ?? null;
    }
  });

  const { error: dealError } = await supabase
    .from('deals')
    .update(dealUpdate)
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);

  if (dealError) return NextResponse.json({ success: false, error: dealError.message }, { status: 500 });

  const primaryAssignmentTouched = Object.prototype.hasOwnProperty.call(parsed.data, 'assigned_user_id');
  const nextAssignedUserId = primaryAssignmentTouched ? parsed.data.assigned_user_id ?? null : existing.assigned_user_id;
  const assignmentSummary = assignmentFields.reduce<Record<string, string | null | undefined>>((summary, field) => {
    if (Object.prototype.hasOwnProperty.call(parsed.data, field)) summary[field] = parsed.data[field] ?? null;
    return summary;
  }, {});

  await Promise.allSettled([
    brokerTouched && existing.application_id
      ? supabase.from('applications').update({ iso_broker_id: nextBrokerId, ...(nextBrokerId ? { lead_source: 'iso' } : {}), updated_by: profile.id }).eq('id', existing.application_id).eq('organization_id', profile.organization_id)
      : Promise.resolve(),
    brokerTouched && existing.lead_id
      ? supabase.from('leads').update({ iso_broker_id: nextBrokerId, ...(nextBrokerId ? { lead_source: 'iso' } : {}), updated_by: profile.id }).eq('id', existing.lead_id).eq('organization_id', profile.organization_id)
      : Promise.resolve(),
    primaryAssignmentTouched && existing.application_id
      ? supabase.from('applications').update({ assigned_user_id: nextAssignedUserId, updated_by: profile.id }).eq('id', existing.application_id).eq('organization_id', profile.organization_id)
      : Promise.resolve(),
    primaryAssignmentTouched && existing.lead_id
      ? supabase.from('leads').update({ assigned_user_id: nextAssignedUserId, updated_by: profile.id }).eq('id', existing.lead_id).eq('organization_id', profile.organization_id)
      : Promise.resolve(),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: existing.id,
      application_id: existing.application_id,
      lead_id: existing.lead_id,
      activity_type: 'system',
      title: assignmentTouched ? 'Deal rep assignment updated' : nextBrokerId ? 'Broker assigned to deal' : 'Broker removed from deal',
      body: assignmentTouched ? 'Primary rep, junior rep, or senior rep assignment was updated.' : nextBrokerId ? 'Deal, application, and lead broker assignment were updated.' : 'Broker assignment was removed from the deal.',
      direction: 'internal',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: assignmentTouched ? 'deal_assignment_updated' : 'deal_broker_updated',
      resource_type: 'deals',
      resource_id: existing.id,
      old_data: {
        iso_broker_id: existing.iso_broker_id,
        assigned_user_id: existing.assigned_user_id,
        junior_closer_id: existing.junior_closer_id,
        senior_closer_id: existing.senior_closer_id,
      },
      new_data: {
        ...(brokerTouched ? { iso_broker_id: nextBrokerId } : {}),
        ...assignmentSummary,
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
