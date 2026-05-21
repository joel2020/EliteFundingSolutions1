import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Lender ID required' }, { status: 400 });

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: existing } = await supabase
    .from('funding_partners')
    .select('id,organization_id,name,is_active,deleted_at')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!existing) return NextResponse.json({ error: 'Lender not found' }, { status: 404 });

  const { error } = await supabase
    .from('funding_partners')
    .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: profile.id })
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'funding_partner_archived',
    resource_type: 'funding_partners',
    resource_id: id,
    old_data: existing,
    new_data: { is_active: false, deleted_at: true },
  });

  return NextResponse.json({ success: true, message: 'Lender deleted successfully' });
}
