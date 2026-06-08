import { NextResponse } from 'next/server';
import { CRM_ACCESS_ROLES } from '@/lib/access-control';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { createServiceSupabaseClient } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ success: false, error: error || 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id,user_id,organization_id,email,first_name,last_name,role,permissions,access_entity_type,access_entity_id,is_active')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ success: false, error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ success: false, error: 'No CRM profile is linked to this user. Contact an administrator.' }, { status: 404 });
  }

  if (!profile.is_active) {
    return NextResponse.json({ success: false, error: 'Your CRM profile is inactive. Contact an administrator.' }, { status: 403 });
  }

  if (!CRM_ACCESS_ROLES.includes(profile.role as any)) {
    return NextResponse.json({ success: false, error: 'Your role is not allowed to access the CRM.' }, { status: 403 });
  }

  return NextResponse.json({ success: true, profile });
}
