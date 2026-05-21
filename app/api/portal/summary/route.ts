import { NextResponse } from 'next/server';
import { getPortalApplicationIds, requirePortalProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  const auth = await requirePortalProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const applicationIds = await getPortalApplicationIds(supabase, user, profile.organization_id, profile);

  if (!applicationIds.length) {
    return NextResponse.json({ success: true, applications: [], documents: [], offers: [] }, { headers: noStoreHeaders });
  }

  const [applicationsResult, documentsResult, offersResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id,organization_id,status,requested_amount,created_at,submitted_at,lead_id,businesses(legal_name,dba),leads(email)')
      .eq('organization_id', profile.organization_id)
      .in('id', applicationIds)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('documents')
      .select('id,application_id,label,file_name,status,created_at')
      .eq('organization_id', profile.organization_id)
      .in('application_id', applicationIds)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('offers')
      .select('id,deal_id,approved_amount,payback_amount,payment_frequency,daily_payment,weekly_payment,term_days,status,created_at,deals!inner(application_id,title,businesses(legal_name,dba))')
      .eq('organization_id', profile.organization_id)
      .in('deals.application_id', applicationIds)
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  const error = applicationsResult.error || documentsResult.error || offersResult.error;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: noStoreHeaders });
  }

  return NextResponse.json({
    success: true,
    applications: applicationsResult.data || [],
    documents: documentsResult.data || [],
    offers: offersResult.data || [],
  }, { headers: noStoreHeaders });
}
