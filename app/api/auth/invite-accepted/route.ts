import { NextResponse } from 'next/server';
import { getAuthenticatedUser, requireSameOrigin } from '@/lib/server-auth';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';

function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const { user, error } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ success: false, error: error || 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabaseClient();
  const acceptedAt = new Date().toISOString();

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .update({ invite_status: 'accepted', invite_accepted_at: acceptedAt, last_login_at: acceptedAt })
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .select('id,organization_id,role,email')
    .maybeSingle();

  if (profileError) return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ success: false, error: 'Active profile not found.' }, { status: 404 });

  await supabase
    .from('crm_access_invites')
    .update({
      status: 'accepted',
      accepted_at: acceptedAt,
      user_profile_id: profile.id,
      auth_user_id: user.id,
    })
    .eq('organization_id', profile.organization_id)
    .eq('email', profile.email)
    .in('status', ['pending', 'sent']);

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id || DEFAULT_ORG_ID,
    user_id: user.id,
    action: 'invite_accepted',
    resource_type: 'user_profiles',
    resource_id: profile.id,
    ip_address: clientIp(request),
    user_agent: request.headers.get('user-agent'),
    new_data: { role: profile.role, accepted_at: acceptedAt },
  });

  return NextResponse.json({ success: true, accepted_at: acceptedAt });
}
