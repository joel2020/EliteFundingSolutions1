import { NextResponse } from 'next/server';
import { getPortalApplicationIds, requirePortalProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requirePortalProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const applicationIds = await getPortalApplicationIds(supabase, user, profile.organization_id);
  if (!applicationIds.length) {
    return NextResponse.json({ success: false, error: 'Contract not found.' }, { status: 404 });
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id,organization_id,status,storage_path,signed_storage_path,deals!inner(application_id)')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  const deal = Array.isArray(contract?.deals) ? contract?.deals[0] : contract?.deals;
  if (error || !contract || !deal || !applicationIds.includes(deal.application_id)) {
    return NextResponse.json({ success: false, error: 'Contract not found.' }, { status: 404 });
  }

  const storagePath = contract.signed_storage_path || contract.storage_path;
  if (!storagePath) {
    return NextResponse.json({ success: false, error: 'No contract file is available yet.' }, { status: 404 });
  }

  const { data, error: signedError } = await supabase.storage
    .from('application-documents')
    .createSignedUrl(storagePath, 120, { download: contract.signed_storage_path ? 'signed-contract.pdf' : 'contract.pdf' });

  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ success: false, error: 'Unable to open contract.' }, { status: 500 });
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: contract.signed_storage_path ? 'portal_signed_contract_download_url_created' : 'portal_contract_download_url_created',
    resource_type: 'contracts',
    resource_id: contract.id,
    new_data: { expires_in_seconds: 120, signed: Boolean(contract.signed_storage_path) },
  });

  return NextResponse.json({ success: true, url: data.signedUrl });
}
