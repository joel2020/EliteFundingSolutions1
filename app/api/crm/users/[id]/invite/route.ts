import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { sendEmail, emailTemplates } from '@/lib/email';

export const dynamic = 'force-dynamic';

const ADMIN_ROLES = ['super_admin', 'admin'];

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(ADMIN_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: target, error: targetError } = await supabase
    .from('user_profiles')
    .select('id,user_id,organization_id,email,first_name,last_name,role,company_name,permissions,access_entity_type,access_entity_id,is_active,deleted_at')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (targetError) return NextResponse.json({ success: false, error: targetError.message }, { status: 500 });
  if (!target || target.deleted_at) return NextResponse.json({ success: false, error: 'User profile not found.' }, { status: 404 });
  if (!target.is_active) return NextResponse.json({ success: false, error: 'Reactivate this user before resending an invite.' }, { status: 400 });
  if (target.role === 'super_admin' && profile.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only a super admin can invite a super admin.' }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const invited = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: target.email,
    options: {
      redirectTo: `${appUrl}/set-password`,
      data: {
        first_name: target.first_name,
        last_name: target.last_name,
        role: target.role,
        access_entity_type: target.access_entity_type,
        access_entity_id: target.access_entity_id,
      },
    },
  });

  const invitedUser = invited.data?.user;
  const inviteUrl = (invited.data as any)?.properties?.action_link;
  if (invited.error || !invitedUser || !inviteUrl) {
    return NextResponse.json({ success: false, error: invited.error?.message || 'Unable to generate invite link.' }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      user_id: invitedUser.id,
      invite_status: 'sent',
      invited_at: new Date().toISOString(),
      invite_expires_at: inviteExpiresAt,
      updated_by: profile.id,
    })
    .eq('id', target.id)
    .eq('organization_id', profile.organization_id);

  if (updateError) return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });

  const emailResult = await sendEmail({
    to: target.email,
    subject: `You've been invited to Elite Funding Solutions`,
    html: emailTemplates.userInvite(target.first_name, inviteUrl, target.role, target.company_name || undefined),
  });

  await supabase.from('crm_access_invites').insert({
    organization_id: profile.organization_id,
    email: target.email,
    first_name: target.first_name || '',
    last_name: target.last_name || '',
    company_name: target.company_name || null,
    role: target.role,
    permissions: Array.isArray(target.permissions) ? target.permissions : [],
    access_entity_type: target.access_entity_type || 'internal',
    access_entity_id: target.access_entity_id || null,
    status: emailResult.success ? 'sent' : 'failed',
    auth_user_id: invitedUser.id,
    user_profile_id: target.id,
    invited_by: profile.id,
    invite_expires_at: inviteExpiresAt,
    resent_count: 1,
    last_error: emailResult.success ? null : String(emailResult.error || 'Email delivery failed.'),
    metadata: { source: 'crm_users_access_resend' },
  });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'invite_resent',
    resource_type: 'user_profiles',
    resource_id: target.id,
    new_data: { email: target.email, role: target.role, email_sent: emailResult.success, invite_expires_at: inviteExpiresAt },
  });

  return NextResponse.json({ success: true, emailSent: emailResult.success, invite_expires_at: inviteExpiresAt });
}
