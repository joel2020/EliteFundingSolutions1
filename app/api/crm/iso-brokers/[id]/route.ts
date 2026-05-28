import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];
const DELETE_ROLES = ['super_admin', 'admin'];
const updateBrokerSchema = z.object({
  is_active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = updateBrokerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid broker update.' }, { status: 400 });

  const { data: existing } = await supabase
    .from('iso_brokers')
    .select('id,organization_id,is_active,company_name')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!existing) return NextResponse.json({ success: false, error: 'Broker not found.' }, { status: 404 });

  const { error } = await supabase
    .from('iso_brokers')
    .update(parsed.data)
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'iso_broker_updated',
    resource_type: 'iso_brokers',
    resource_id: existing.id,
    old_data: { is_active: existing.is_active },
    new_data: parsed.data,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(DELETE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;
  const { id } = await params;

  const { data: existing } = await supabase
    .from('iso_brokers')
    .select('id,organization_id,is_active,company_name,broker_name,deleted_at')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!existing || existing.deleted_at) {
    return NextResponse.json({ success: false, error: 'Broker not found.' }, { status: 404 });
  }

  const deletedAt = new Date().toISOString();
  const { error } = await supabase
    .from('iso_brokers')
    .update({ is_active: false, deleted_at: deletedAt })
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'iso_broker_deleted',
      resource_type: 'iso_brokers',
      resource_id: existing.id,
      old_data: existing,
      new_data: { deleted_at: deletedAt, is_active: false },
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      activity_type: 'system',
      title: 'ISO broker deleted',
      body: `${existing.company_name} was removed from the active ISO / broker list.`,
      direction: 'internal',
      performed_by: profile.id,
      resource_type: 'iso_brokers',
      resource_id: existing.id,
    }),
  ]);

  return NextResponse.json({ success: true });
}
