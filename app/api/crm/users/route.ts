import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['super_admin', 'admin'];

function referralSlugForUser(firstName: string, lastName: string, email: string, userId: string) {
  const base = [firstName, lastName].filter(Boolean).join('-') || email.split('@')[0] || 'rep';
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64) || 'rep';
  return `${clean}-${userId.slice(0, 8)}`;
}

const createUserSchema = z.object({
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'client']).default('sales_rep'),
  is_active: z.boolean().default(true),
});

export async function POST(request: Request) {
  const auth = await requireCrmProfile(ADMIN_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = createUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid user payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const form = parsed.data;
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;
  const invited = await supabase.auth.admin.inviteUserByEmail(form.email, {
    redirectTo,
    data: {
      first_name: form.first_name,
      last_name: form.last_name,
    },
  });

  if (invited.error || !invited.data.user) {
    return NextResponse.json({ success: false, error: invited.error?.message || 'Unable to invite user.' }, { status: 500 });
  }

  const { data: createdProfile, error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: invited.data.user.id,
        organization_id: profile.organization_id,
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
        is_active: form.is_active,
        referral_slug: referralSlugForUser(form.first_name, form.last_name, form.email, invited.data.user.id),
        created_by: profile.id,
        updated_by: profile.id,
      },
      { onConflict: 'user_id,organization_id' },
    )
    .select('id,user_id,organization_id,email,first_name,last_name,role,is_active,last_login_at,referral_slug')
    .single();

  if (profileError) {
    return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'crm_user_invited',
    resource_type: 'user_profiles',
    resource_id: createdProfile.id,
    new_data: { email: form.email, role: form.role, is_active: form.is_active },
  });

  return NextResponse.json({ success: true, user: createdProfile });
}
