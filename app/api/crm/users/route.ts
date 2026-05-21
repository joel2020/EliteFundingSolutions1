import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { sendEmail, emailTemplates } from '@/lib/email';
import { createOpaqueApplyToken, isBlockedProductionEmail } from '@/lib/referral-tokens';
import { CRM_ACCESS_ROLES, accessEntityTypeForRole } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['super_admin', 'admin'];
const USER_ROLES = [...CRM_ACCESS_ROLES, 'client'] as const;

function referralSlugForUser(firstName: string, lastName: string, email: string, userId: string) {
  const base = [firstName, lastName].filter(Boolean).join('-') || email.split('@')[0] || 'rep';
  const clean = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64) || 'rep';
  return `${clean}-${userId.slice(0, 8)}`;
}

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

const createUserSchema = z.object({
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  email: z.string().email(),
  role: z.enum(USER_ROLES).default('sales_rep'),
  company_name: z.string().trim().optional().default(''),
  access_entity_type: z.enum(['internal', 'funding_partner', 'iso_broker', 'referral_partner', 'broker', 'client']).optional(),
  access_entity_id: z.string().uuid().optional().or(z.literal('')).default(''),
  permissions: z.array(z.string()).optional().default([]),
  is_active: z.boolean().default(true),
});

async function ensureAccessEntity({
  supabase,
  profile,
  form,
}: {
  supabase: any;
  profile: { id: string; organization_id: string };
  form: z.infer<typeof createUserSchema>;
}) {
  const requestedType = form.access_entity_type || accessEntityTypeForRole(form.role);
  const accessEntityType = requestedType === 'broker' || requestedType === 'referral_partner' ? 'iso_broker' : requestedType;
  const providedId = form.access_entity_id || null;
  if (providedId || accessEntityType === 'internal' || accessEntityType === 'client') {
    return { accessEntityType, accessEntityId: providedId };
  }

  const displayName = [form.first_name, form.last_name].filter(Boolean).join(' ') || form.email;
  const companyName = form.company_name || `${displayName} Access`;

  if (accessEntityType === 'funding_partner') {
    const { data, error } = await supabase
      .from('funding_partners')
      .insert({
        organization_id: profile.organization_id,
        name: companyName,
        contact_name: displayName,
        email: form.email,
        submission_email: form.email,
        is_active: true,
        created_by: profile.id,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { accessEntityType, accessEntityId: data.id };
  }

  if (accessEntityType === 'iso_broker') {
    const brokerName = displayName;
    const applicationSlug = `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'partner'}-${Date.now().toString(36)}`;
    const { data, error } = await supabase
      .from('iso_brokers')
      .insert({
        organization_id: profile.organization_id,
        company_name: companyName,
        broker_name: brokerName,
        email: form.email,
        is_active: true,
        application_slug: applicationSlug,
        application_token: createOpaqueApplyToken('iso'),
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { accessEntityType, accessEntityId: data.id };
  }

  return { accessEntityType, accessEntityId: null };
}

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
  if (isProductionRuntime() && isBlockedProductionEmail(form.email)) {
    return NextResponse.json({ success: false, error: 'Test/demo email domains are blocked in production invites.' }, { status: 400 });
  }

  if (form.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only a super admin can grant super admin.' }, { status: 403 });
  }

  let accessEntity: { accessEntityType: string; accessEntityId: string | null };
  try {
    accessEntity = await ensureAccessEntity({ supabase, profile, form });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to create access organization.' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  // Point redirectTo at /set-password so the user lands on the password-creation page
  const redirectTo = `${appUrl}/set-password`;
  const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const invited = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: form.email,
    options: {
      redirectTo,
      data: {
        first_name: form.first_name,
        last_name: form.last_name,
        role: form.role,
        access_entity_type: accessEntity.accessEntityType,
        access_entity_id: accessEntity.accessEntityId,
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
        company_name: form.company_name || null,
        access_entity_type: accessEntity.accessEntityType,
        access_entity_id: accessEntity.accessEntityId,
        permissions: form.permissions,
        is_active: form.is_active,
        invite_status: 'sent',
        invited_at: new Date().toISOString(),
        invite_expires_at: inviteExpiresAt,
        referral_slug: referralSlugForUser(form.first_name, form.last_name, form.email, invitedUser.id),
        referral_token: createOpaqueApplyToken('rep'),
        created_by: profile.id,
        updated_by: profile.id,
      },
      { onConflict: 'user_id,organization_id' },
    )
    .select('id,user_id,organization_id,email,first_name,last_name,role,company_name,access_entity_type,access_entity_id,permissions,is_active,last_login_at,invite_status,invited_at,invite_expires_at,invite_accepted_at,referral_slug,referral_token')
    .single();

  if (profileError) {
    return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
  }

  // Build the invite URL — Supabase embeds the token in the redirectTo URL
  // The user_metadata action_link contains the full magic link

  // Send branded invite email via Resend (non-blocking — don't fail the request if email fails)
  const emailResult = await sendEmail({
    to: form.email,
    subject: `You've been invited to Elite Funding Solutions`,
    html: emailTemplates.userInvite(
      form.first_name,
      inviteUrl,
      form.role,
      form.company_name || undefined,
    ),
  });

  if (!emailResult.success) {
    console.error('Invite email failed to send:', emailResult.error);
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'user_invited',
    resource_type: 'user_profiles',
    resource_id: createdProfile.id,
    new_data: { email: form.email, role: form.role, permissions: form.permissions, access_entity_type: accessEntity.accessEntityType, access_entity_id: accessEntity.accessEntityId, invite_expires_at: inviteExpiresAt, is_active: form.is_active },
  });

  await supabase.from('crm_access_invites').insert({
    organization_id: profile.organization_id,
    email: form.email,
    first_name: form.first_name,
    last_name: form.last_name,
    company_name: form.company_name || null,
    role: form.role,
    permissions: form.permissions,
    access_entity_type: accessEntity.accessEntityType,
    access_entity_id: accessEntity.accessEntityId,
    status: emailResult.success ? 'sent' : 'failed',
    auth_user_id: invitedUser.id,
    user_profile_id: createdProfile.id,
    invited_by: profile.id,
    invite_expires_at: inviteExpiresAt,
    last_error: emailResult.success ? null : String(emailResult.error || 'Email delivery failed.'),
    metadata: { source: 'crm_users_access' },
  });

  return NextResponse.json({
    success: true,
    user: createdProfile,
    emailSent: emailResult.success,
  });
}
