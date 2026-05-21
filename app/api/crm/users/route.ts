import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { sendEmail, emailTemplates } from '@/lib/email';

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
  role: z.enum(['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'client', 'viewer']).default('sales_rep'),
  permissions: z.array(z.string()).optional().default([]),
  is_active: z.boolean().default(true),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(ADMIN_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = createUserSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid user payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const form = parsed.data;
  if (form.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only a super admin can grant super admin.' }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  // Point redirectTo at /set-password so the user lands on the password-creation page
  const redirectTo = `${appUrl}/set-password`;

  const invited = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: form.email,
    options: {
      redirectTo,
      data: {
        first_name: form.first_name,
        last_name: form.last_name,
      },
    },
  });

  const invitedUser = invited.data?.user;
  const inviteUrl = (invited.data as any)?.properties?.action_link;

  if (invited.error || !invitedUser || !inviteUrl) {
    return NextResponse.json({ success: false, error: invited.error?.message || 'Unable to generate invite link.' }, { status: 500 });
  }

  const { data: createdProfile, error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: invitedUser.id,
        organization_id: profile.organization_id,
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
        permissions: form.permissions,
        is_active: form.is_active,
        referral_slug: referralSlugForUser(form.first_name, form.last_name, form.email, invitedUser.id),
        created_by: profile.id,
        updated_by: profile.id,
      },
      { onConflict: 'user_id,organization_id' },
    )
    .select('id,user_id,organization_id,email,first_name,last_name,role,permissions,is_active,last_login_at,referral_slug')
    .single();

  if (profileError) {
    return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
  }

  // Build the invite URL — Supabase embeds the token in the redirectTo URL
  // The user_metadata action_link contains the full magic link

  // Send branded invite email via Resend (non-blocking — don't fail the request if email fails)
  const emailResult = await sendEmail({
    to: form.email,
    subject: `You're invited to Elite Funding Solutions`,
    html: emailTemplates.userInvite(
      form.first_name,
      inviteUrl,
      form.role,
    ),
  });

  if (!emailResult.success) {
    console.error('Invite email failed to send:', emailResult.error);
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'crm_user_invited',
    resource_type: 'user_profiles',
    resource_id: createdProfile.id,
    new_data: { email: form.email, role: form.role, permissions: form.permissions, is_active: form.is_active },
  });

  return NextResponse.json({
    success: true,
    user: createdProfile,
    emailSent: emailResult.success,
  });
}
