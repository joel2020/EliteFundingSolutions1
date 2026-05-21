import { NextResponse } from 'next/server';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const [lenders, brokers, users] = await Promise.all([
    supabase
      .from('funding_partners')
      .select('id,name,email,submission_email,phone,is_active,deleted_at,deleted_by')
      .eq('organization_id', profile.organization_id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(250),
    supabase
      .from('iso_brokers')
      .select('id,company_name,broker_name,email,phone,is_active,deleted_at,deleted_by')
      .eq('organization_id', profile.organization_id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(250),
    supabase
      .from('user_profiles')
      .select('id,email,first_name,last_name,role,is_active,deleted_at,deleted_by,last_login_at')
      .eq('organization_id', profile.organization_id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(250),
  ]);

  const failed = [lenders, brokers, users].find((result) => result.error);
  if (failed?.error) {
    return NextResponse.json({ success: false, error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    records: {
      lenders: lenders.data || [],
      brokers: brokers.data || [],
      users: users.data || [],
    },
  });
}
