import { NextResponse } from 'next/server';
import { requireCrmAccess, requireSameOrigin } from '@/lib/server-auth';
import { isInternalCrmRole, isIsoPartnerRole } from '@/lib/access-control';
import { classifyDealDocumentUpload } from '@/lib/document-classification';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'iso_broker', 'broker', 'referral_partner'];
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmAccess(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ success: false, error: 'Invalid document payload.' }, { status: 400 });

  const file = formData.get('file');
  const explicitDocumentType = String(formData.get('document_type') || '').trim();
  const explicitLabel = String(formData.get('label') || '').trim();
  const reviewNotes = String(formData.get('review_notes') || '').trim();
  const documentRequestId = String(formData.get('document_request_id') || '').trim() || null;
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ success: false, error: 'Document file is required.' }, { status: 400 });
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.size > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(file.type) && !allowedExtensions.has(extension))) {
    return NextResponse.json({ success: false, error: 'Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.' }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,iso_broker_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  if (!isInternalCrmRole(profile.role)) {
    const canUploadAsIso = isIsoPartnerRole(profile.role)
      && profile.access_entity_id
      && deal.iso_broker_id === profile.access_entity_id;

    if (!canUploadAsIso) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
  }

  let documentRequestQuery = supabase
    .from('document_requests')
    .select('id,label,document_type,category,status,required,notes,description')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(50);
  documentRequestQuery = deal.application_id
    ? documentRequestQuery.or(`deal_id.eq.${deal.id},application_id.eq.${deal.application_id}`)
    : documentRequestQuery.eq('deal_id', deal.id);
  const { data: documentRequests } = await documentRequestQuery;

  if (documentRequestId) {
    const requestRow = (documentRequests || []).find((row) => row.id === documentRequestId);
    if (!requestRow) return NextResponse.json({ success: false, error: 'Document request not found for this deal.' }, { status: 404 });
  }

  const classification = await classifyDealDocumentUpload({
    fileName: file.name,
    mimeType: file.type || null,
    bytes,
    requests: documentRequests || [],
    explicitDocumentType,
  });
  const documentType = classification.document_type;
  const linkedRequestId = documentRequestId || classification.matched_request_id || null;
  const label = explicitLabel || classification.label;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${profile.organization_id}/${deal.id}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from('application-documents')
    .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      document_request_id: linkedRequestId,
      document_type: documentType,
      label,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      storage_path: storagePath,
      status: 'uploaded',
      uploaded_by_user_id: user.id,
      review_notes: reviewNotes || null,
      visibility: isInternalCrmRole(profile.role) ? 'internal' : 'shared',
    })
    .select('id,file_name,label,document_type,status,created_at')
    .single();

  if (documentError) return NextResponse.json({ success: false, error: documentError.message }, { status: 500 });

  if (linkedRequestId) {
    await supabase
      .from('document_requests')
      .update({ status: 'uploaded', related_document_id: document.id, notes: reviewNotes || null, updated_by: profile.id })
      .eq('id', linkedRequestId)
      .eq('organization_id', profile.organization_id);
  }

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'document_event',
      title: `Document uploaded: ${label}`,
      body: file.name,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: isInternalCrmRole(profile.role) ? 'deal_document_uploaded' : 'external_partner_document_uploaded',
      resource_type: 'documents',
      resource_id: document.id,
      new_data: { deal_id: deal.id, document_type: documentType, file_name: file.name, document_request_id: linkedRequestId, classification, external_role: isInternalCrmRole(profile.role) ? null : profile.role },
    }),
  ]);

  return NextResponse.json({ success: true, document, classification });
}
