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
  const loginAt = new Date().toISOString();
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .update({ last_login_at: loginAt })
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .select('id,organization_id,role,email')
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ success: false, error: 'Active profile not found.' }, { status: 404 });
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id || DEFAULT_ORG_ID,
    user_id: user.id,
    action: 'login',
    resource_type: 'user_profiles',
    resource_id: profile.id,
    ip_address: clientIp(request),
    user_agent: request.headers.get('user-agent'),
    new_data: { role: profile.role, method: 'password', login_at: loginAt },
  });

  return NextResponse.json({ success: true, last_login_at: loginAt });
}
