import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];
const updateBrokerSchema = z.object({
  is_active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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
    .eq('id', params.id)
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
