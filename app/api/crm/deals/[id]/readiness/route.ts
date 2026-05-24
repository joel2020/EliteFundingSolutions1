import { NextResponse } from 'next/server';
import { requireCrmProfile } from '@/lib/server-auth';
import { evaluateDealReadinessForLenderSubmission } from '@/lib/deal-readiness';

export const dynamic = 'force-dynamic';

const READ_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'viewer', 'iso_broker', 'broker'];

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCrmProfile(READ_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,application_id,business_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();
  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const readiness = await evaluateDealReadinessForLenderSubmission({
    supabase,
    organizationId: profile.organization_id,
    dealId: deal.id,
    applicationId: deal.application_id,
    businessId: deal.business_id,
    allowAdminOverride: ['super_admin', 'admin'].includes(profile.role),
  });

  return NextResponse.json({ success: true, ...readiness });
}

