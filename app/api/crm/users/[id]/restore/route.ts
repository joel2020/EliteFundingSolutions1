import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { createOpaqueApplyToken } from '@/lib/referral-tokens';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['super_admin', 'admin'];
const REFERRAL_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(ADMIN_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id,user_id,organization_id,email,first_name,last_name,role,is_active,deleted_at,deleted_by,referral_token')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .not('deleted_at', 'is', null)
    .single();

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Archived user not found.' }, { status: 404 });
  }

  if (existing.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only a super admin can restore a super admin.' }, { status: 403 });
  }

  const { data: restored, error } = await supabase
    .from('user_profiles')
    .update({
      is_active: true,
      deleted_at: null,
      deleted_by: null,
      updated_by: profile.id,
      referral_token:
        existing.referral_token || (REFERRAL_ROLES.includes(existing.role) ? createOpaqueApplyToken('rep') : null),
    })
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id)
    .select('id,user_id,organization_id,email,first_name,last_name,role,permissions,is_active,last_login_at,referral_slug,referral_token')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'crm_user_restored',
    resource_type: 'user_profiles',
    resource_id: existing.id,
    old_data: existing,
    new_data: { is_active: true, deleted_at: null },
  });

  return NextResponse.json({ success: true, user: restored });
}
