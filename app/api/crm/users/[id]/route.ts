import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['super_admin', 'admin'];
const updateUserSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'client', 'viewer']).optional(),
  permissions: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  referral_slug: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined),
    z.string().regex(/^[a-z0-9][a-z0-9._-]{0,96}$/).optional(),
  ),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCrmProfile(ADMIN_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = updateUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid user payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id,organization_id,role,email,is_active,referral_slug,permissions')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!existing) {
    return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
  }

  if (existing.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only a super admin can edit a super admin.' }, { status: 403 });
  }

  if (parsed.data.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only a super admin can grant super admin.' }, { status: 403 });
  }

  const { data: updatedProfile, error } = await supabase
    .from('user_profiles')
    .update({ ...parsed.data, updated_by: profile.id })
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .select('id,user_id,organization_id,email,first_name,last_name,role,permissions,is_active,last_login_at,referral_slug')
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
    new_data: parsed.data,
  });

  return NextResponse.json({ success: true, user: updatedProfile });
}
