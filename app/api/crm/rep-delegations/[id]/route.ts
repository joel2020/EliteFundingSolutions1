import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['super_admin', 'admin', 'manager'];

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(MANAGE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: existing } = await supabase
    .from('rep_delegations')
    .select('id,delegate_user_profile_id,owner_user_profile_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ success: false, error: 'Delegation not found.' }, { status: 404 });

  const { error } = await supabase
    .from('rep_delegations')
    .delete()
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'rep_delegation_revoked',
    resource_type: 'rep_delegations',
    resource_id: params.id,
    old_data: existing,
  }).then(() => null, () => null);

  return NextResponse.json({ success: true });
}
