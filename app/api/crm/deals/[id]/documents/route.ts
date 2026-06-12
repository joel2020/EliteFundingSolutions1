import { NextResponse } from 'next/server';
import { requireCrmAccess, requireSameOrigin } from '@/lib/server-auth';
import { isInternalCrmRole, isIsoPartnerRole } from '@/lib/access-control';
import { classifyDealDocumentUpload, sameCrmDocumentType } from '@/lib/document-classification';
import { extractBankStatementSignals } from '@/lib/bank-statement-extraction';
import { createCrmNotification } from '@/lib/crm-notifications';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'iso_broker', 'broker', 'referral_partner'];
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

async function removeUploadedDealDocument(supabase: any, storagePath: string) {
  if (!storagePath) return;
  await supabase.storage.from('application-documents').remove([storagePath]).catch(() => null);
}

function normalizeRequirementList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function classificationReviewNote(classification: Awaited<ReturnType<typeof classifyDealDocumentUpload>>) {
  const pieces = [
    `Classified as ${classification.label || classification.document_type}`,
    `${classification.confidence} confidence`,
    `via ${classification.provider === 'rules' ? 'document rules' : 'AI document review'}`,
    classification.reasoning ? `Reason: ${classification.reasoning}` : '',
    classification.error ? `Fallback note: ${classification.error}` : '',
  ].filter(Boolean);
  return `Document classification: ${pieces.join(' | ')}`;
}

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
    .select('id,organization_id,business_id,application_id,lead_id,iso_broker_id,assigned_user_id,title')
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
  const { data: fundingPartners } = await supabase
    .from('funding_partners')
    .select('required_documents,product_types,notes,criteria_notes')
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .limit(100);
  const funderRequirements = Array.from(new Set((fundingPartners || []).flatMap((partner: any) => [
    ...normalizeRequirementList(partner.required_documents),
    ...normalizeRequirementList(partner.product_types).filter((item) => /document|statement|license|check|tax|invoice|payoff|stip|receivable|aging|a\/?r/i.test(item)),
    ...normalizeRequirementList(partner.notes).filter((item) => /statement|license|check|tax|invoice|payoff|stip|processing|contract|receivable|aging|a\/?r/i.test(item)),
    ...normalizeRequirementList(partner.criteria_notes).filter((item) => /statement|license|check|tax|invoice|payoff|stip|processing|contract|receivable|aging|a\/?r/i.test(item)),
  ])));

  if (documentRequestId) {
    const requestRow = (documentRequests || []).find((row) => row.id === documentRequestId);
    if (!requestRow) return NextResponse.json({ success: false, error: 'Document request not found for this deal.' }, { status: 404 });
  }

  const classification = await classifyDealDocumentUpload({
    fileName: file.name,
    mimeType: file.type || null,
    bytes,
    requests: documentRequests || [],
    funderRequirements,
    explicitDocumentType,
  });
  const documentType = classification.document_type;
  const linkedRequestId = documentRequestId || classification.matched_request_id || null;
  const label = explicitLabel || classification.label;
  const initialReviewNotes = [reviewNotes, classificationReviewNote(classification)].filter(Boolean).join('\n\n') || null;

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
      review_notes: initialReviewNotes,
      visibility: isInternalCrmRole(profile.role) ? 'internal' : 'shared',
    })
    .select('id,file_name,label,document_type,status,created_at')
    .single();

  if (documentError) {
    await removeUploadedDealDocument(supabase, storagePath);
    return NextResponse.json({ success: false, error: documentError.message }, { status: 500 });
  }

  let aiExtraction = null;
  if (sameCrmDocumentType(documentType, 'bank_statements') || sameCrmDocumentType(documentType, 'bank_statement')) {
    aiExtraction = await extractBankStatementSignals({
      fileName: file.name,
      mimeType: file.type || null,
      bytes,
    });
    const extractionSummary = [
      'AI bank statement extraction',
      aiExtraction.bank_name ? `Bank: ${aiExtraction.bank_name}` : '',
      aiExtraction.statement_period_start || aiExtraction.statement_period_end ? `Period: ${[aiExtraction.statement_period_start, aiExtraction.statement_period_end].filter(Boolean).join(' - ')}` : '',
      aiExtraction.total_deposits ? `Deposits: ${aiExtraction.total_deposits}` : '',
      aiExtraction.ending_balance ? `Ending balance: ${aiExtraction.ending_balance}` : '',
      aiExtraction.negative_days ? `Negative days: ${aiExtraction.negative_days}` : '',
      aiExtraction.nsf_count ? `NSFs: ${aiExtraction.nsf_count}` : '',
    ].filter(Boolean).join(' | ');

    const { error: extractionUpdateError } = await supabase
      .from('documents')
      .update({
        ai_extraction: aiExtraction,
        ai_extracted_at: new Date().toISOString(),
        review_notes: [initialReviewNotes, extractionSummary].filter(Boolean).join('\n\n') || null,
      })
      .eq('id', document.id)
      .eq('organization_id', profile.organization_id);

    if (extractionUpdateError) {
      await supabase
        .from('documents')
        .update({ review_notes: [initialReviewNotes, extractionSummary].filter(Boolean).join('\n\n') || null })
        .eq('id', document.id)
        .eq('organization_id', profile.organization_id);
    }
  }

  if (linkedRequestId) {
    await supabase
      .from('document_requests')
      .update({ status: 'uploaded', related_document_id: document.id, notes: reviewNotes || null, updated_by: profile.id })
      .eq('id', linkedRequestId)
      .eq('organization_id', profile.organization_id);
  }

  await Promise.allSettled([
    createCrmNotification({
      organizationId: profile.organization_id,
      actorUserProfileId: profile.id,
      recipientUserProfileId: deal.assigned_user_id || null,
      resourceType: 'deals',
      resourceId: deal.id,
      title: `Document uploaded: ${label}`,
      body: `${file.name} uploaded to ${deal.title || 'deal'}${isInternalCrmRole(profile.role) ? '' : ' by an external partner'}.`,
      severity: 'info',
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'document_event',
      title: `Document uploaded: ${label}`,
      body: aiExtraction ? `${file.name} - AI extracted bank statement signals.` : file.name,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: isInternalCrmRole(profile.role) ? 'deal_document_uploaded' : 'external_partner_document_uploaded',
      resource_type: 'documents',
      resource_id: document.id,
      new_data: { deal_id: deal.id, document_type: documentType, file_name: file.name, document_request_id: linkedRequestId, classification, ai_extraction: aiExtraction, external_role: isInternalCrmRole(profile.role) ? null : profile.role },
    }),
  ]);

  return NextResponse.json({ success: true, document: { ...document, ai_extraction: aiExtraction || undefined }, classification, aiExtraction });
}
