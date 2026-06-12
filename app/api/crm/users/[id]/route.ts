import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { isBlockedProductionEmail } from '@/lib/referral-tokens';
import { CRM_ACCESS_ROLES, accessEntityTypeForRole } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['super_admin', 'admin'];
const USER_ROLES = [...CRM_ACCESS_ROLES, 'client'] as const;
const updateUserSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(USER_ROLES).optional(),
  company_name: z.string().trim().optional(),
  access_entity_type: z.enum(['internal', 'funding_partner', 'iso_broker', 'referral_partner', 'broker', 'client']).optional(),
  access_entity_id: z.string().uuid().optional().or(z.literal('')),
  permissions: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  referral_slug: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined),
    z.string().regex(/^[a-z0-9][a-z0-9._-]{0,96}$/).optional(),
  ),
});

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(ADMIN_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = updateUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid user payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  if (isProductionRuntime() && parsed.data.email && isBlockedProductionEmail(parsed.data.email)) {
    return NextResponse.json({ success: false, error: 'Test/demo email domains are blocked in production accounts.' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id,organization_id,role,email,is_active,referral_slug,permissions,access_entity_type,access_entity_id,invite_status')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!existing) {
    return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
  }

  if (existing.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only a super admin can edit a super admin.' }, { status: 403 });
  }

  if (parsed.data.role && ['funder', 'client'].includes(parsed.data.role)) {
    return NextResponse.json({ success: false, error: 'Funders and clients cannot hold CRM user roles. Manage funders under the Funders section.' }, { status: 400 });
  }

  if (parsed.data.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only a super admin can grant super admin.' }, { status: 403 });
  }

  const updatePayload = {
    ...parsed.data,
    access_entity_type: parsed.data.access_entity_type || (parsed.data.role ? accessEntityTypeForRole(parsed.data.role) : undefined),
    access_entity_id: parsed.data.access_entity_id === '' ? null : parsed.data.access_entity_id,
    updated_by: profile.id,
  };

  const { data: updatedProfile, error } = await supabase
    .from('user_profiles')
    .update(updatePayload)
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .select('id,user_id,organization_id,email,first_name,last_name,role,company_name,access_entity_type,access_entity_id,permissions,is_active,last_login_at,invite_status,invited_at,invite_expires_at,invite_accepted_at,referral_slug,referral_token')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'crm_user_updated',
    resource_type: 'user_profiles',
    resource_id: params.id,
    old_data: existing,
    new_data: updatePayload,
  });

  if (parsed.data.role && parsed.data.role !== existing.role) {
    await supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'crm_user_role_changed',
      resource_type: 'user_profiles',
      resource_id: params.id,
      old_data: { role: existing.role },
      new_data: { role: parsed.data.role },
    });
  }

  if (parsed.data.is_active === false && existing.is_active !== false) {
    const revokedAt = new Date().toISOString();
    await Promise.allSettled([
      supabase
        .from('user_profiles')
        .update({ invite_status: 'revoked', access_revoked_at: revokedAt, access_revoked_by: profile.id })
        .eq('id', params.id)
        .eq('organization_id', profile.organization_id),
      supabase
        .from('crm_access_invites')
        .update({ status: 'revoked', revoked_at: revokedAt, revoked_by: profile.id })
        .eq('organization_id', profile.organization_id)
        .eq('user_profile_id', params.id)
        .in('status', ['pending', 'sent']),
      supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        action: 'access_revoked',
        resource_type: 'user_profiles',
        resource_id: params.id,
        old_data: { is_active: existing.is_active, invite_status: existing.invite_status },
        new_data: { is_active: false, invite_status: 'revoked', revoked_at: revokedAt },
      }),
    ]);
  }

  return NextResponse.json({ success: true, user: updatedProfile });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(ADMIN_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id,user_id,organization_id,email,first_name,last_name,role,is_active,deleted_at')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!existing) {
    return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
  }

  if (existing.id === profile.id || existing.user_id === user.id) {
    return NextResponse.json({ success: false, error: 'You cannot delete your own active admin account.' }, { status: 400 });
  }

  if (existing.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only a super admin can delete a super admin.' }, { status: 403 });
  }

  const deletedAt = new Date().toISOString();
  const { data: deletedProfile, error } = await supabase
    .from('user_profiles')
    .update({ is_active: false, invite_status: 'revoked', access_revoked_at: deletedAt, access_revoked_by: profile.id, deleted_at: deletedAt, deleted_by: profile.id, updated_by: profile.id })
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id)
    .select('id,email')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'access_revoked',
    resource_type: 'user_profiles',
    resource_id: existing.id,
    old_data: existing,
    new_data: { is_active: false, invite_status: 'revoked', deleted_at: deletedAt, auth_user_preserved_for_restore: Boolean(existing.user_id) },
  });

  await supabase
    .from('crm_access_invites')
    .update({ status: 'revoked', revoked_at: deletedAt, revoked_by: profile.id })
    .eq('organization_id', profile.organization_id)
    .eq('user_profile_id', existing.id)
    .in('status', ['pending', 'sent']);

  return NextResponse.json({
    success: true,
    user: deletedProfile,
  });
}
