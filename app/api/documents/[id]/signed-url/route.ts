import { NextResponse } from 'next/server';
import { requireCrmAccess, requireSameOrigin } from '@/lib/server-auth';
import { isInternalCrmRole } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

async function funderCanAccessSubmittedDocument(
  supabase: any,
  organizationId: string,
  fundingPartnerId: string,
  dealId: string,
  documentId: string,
) {
  const { data: submissions } = await supabase
    .from('partner_submissions')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('deal_id', dealId)
    .eq('funding_partner_id', fundingPartnerId)
    .limit(100);

  const submissionIds = (submissions || []).map((submission: { id: string }) => submission.id);
  if (!submissionIds.length) return false;

  const { data: attachment } = await supabase
    .from('lender_submission_attachments')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('document_id', documentId)
    .in('partner_submission_id', submissionIds)
    .limit(1)
    .maybeSingle();

  return Boolean(attachment);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmAccess();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, organization_id, deal_id, application_id, storage_path, file_name, visibility, uploaded_by_user_id, uploaded_by')
    .eq('id', params.id)
    .single();

  if (error || !doc || doc.organization_id !== profile.organization_id) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  if (!isInternalCrmRole(profile.role)) {
    let allowed = false;

    if (profile.role === 'funder' && profile.access_entity_type === 'funding_partner' && profile.access_entity_id && doc.deal_id) {
      allowed = await funderCanAccessSubmittedDocument(
        supabase,
        profile.organization_id,
        profile.access_entity_id,
        doc.deal_id,
        doc.id,
      );
    }

    if (!allowed && ['iso_broker', 'broker', 'referral_partner'].includes(profile.role) && profile.access_entity_id && doc.deal_id) {
      const { data: partnerDeal } = await supabase
        .from('deals')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .eq('id', doc.deal_id)
        .eq('iso_broker_id', profile.access_entity_id)
        .limit(1)
        .maybeSingle();

      allowed = Boolean(partnerDeal) && doc.visibility === 'shared';
    }

    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const isDownload = body?.disposition === 'download';
  const { data, error: signedError } = await supabase.storage
    .from('application-documents')
    .createSignedUrl(doc.storage_path, 120, isDownload ? { download: doc.file_name } : undefined);

  if (signedError || !data?.signedUrl) return NextResponse.json({ success: false, error: 'Unable to open document.' }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: isDownload ? 'document_download_signed_url_created' : 'document_preview_signed_url_created',
    resource_type: 'documents',
    resource_id: doc.id,
    new_data: { file_name: doc.file_name, expires_in_seconds: 120, external_role: isInternalCrmRole(profile.role) ? null : profile.role },
  });

  return NextResponse.json({ success: true, url: data.signedUrl });
}
