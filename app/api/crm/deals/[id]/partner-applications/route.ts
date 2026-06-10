import { NextResponse } from 'next/server';
import { cleanupGeneratedApplicationArtifacts } from '@/lib/generated-application-cleanup';
import { extractPartnerApplicationPayloadFromUpload } from '@/lib/partner-application-extraction';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];
const allowedTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/csv',
  'text/plain',
]);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'doc', 'docx', 'csv']);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const DOCUMENT_SELECT = 'id,organization_id,deal_id,application_id,uploaded_by_user_id,document_type,label,file_name,file_size,mime_type,storage_path,status,application_source,application_variant,related_partner_application_upload_id,review_notes,created_at,updated_at';

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 140) || 'partner-application';
}

function text(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data, error } = await supabase
    .from('partner_application_uploads')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('deal_id', params.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, partnerApplications: data || [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ success: false, error: 'Invalid partner application payload.' }, { status: 400 });

  const file = formData.get('file');
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ success: false, error: 'Partner application file is required.' }, { status: 400 });
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.size > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(file.type) && !allowedExtensions.has(extension))) {
    return NextResponse.json({ success: false, error: 'Supported partner applications: PDF, image, DOC/DOCX, or CSV up to 15MB.' }, { status: 400 });
  }

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,title,requested_amount')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (dealError || !deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const { data: dealBusiness } = deal.business_id
    ? await supabase
      .from('businesses')
      .select('*')
      .eq('id', deal.business_id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle()
    : { data: null };

  let applicationId = deal.application_id as string | null;
  if (!applicationId) {
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        organization_id: profile.organization_id,
        business_id: deal.business_id,
        lead_id: deal.lead_id,
        status: 'submitted',
        application_source: 'partner_upload',
        application_review_status: 'converted_from_partner_app',
        requested_amount: deal.requested_amount || null,
        notes: 'Created from partner application upload.',
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (appError) return NextResponse.json({ success: false, error: appError.message }, { status: 500 });
    applicationId = application.id;
    await supabase.from('deals').update({ application_id: applicationId, stage_slug: 'application_submitted' }).eq('id', deal.id).eq('organization_id', profile.organization_id);
  }

  const sourcePartnerName = text(formData.get('source_partner_name'));
  const notes = text(formData.get('notes'));
  const fileBytes = Buffer.from(await file.arrayBuffer());
  const originalPath = `${profile.organization_id}/${deal.id}/partner-applications/${Date.now()}-${safeName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from('application-documents')
    .upload(originalPath, fileBytes, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: applicationId,
      uploaded_by_user_id: user.id,
      document_type: 'partner_application',
      label: 'Original partner application',
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      storage_path: originalPath,
      status: 'uploaded',
      application_source: 'partner_upload',
      application_variant: 'original_partner',
      review_notes: notes || null,
    })
    .select(DOCUMENT_SELECT)
    .single();

  if (documentError) {
    await cleanupGeneratedApplicationArtifacts(supabase, {
      organizationId: profile.organization_id,
      storagePaths: [originalPath],
    });
    return NextResponse.json({ success: false, error: documentError.message }, { status: 500 });
  }

  const extractedPayload = await extractPartnerApplicationPayloadFromUpload({
    fileName: file.name,
    mimeType: file.type || null,
    bytes: fileBytes,
    fallback: {
      company_name: (dealBusiness as any)?.legal_name || deal.title || '',
      legal_name: (dealBusiness as any)?.legal_name || deal.title || '',
      business_address: (dealBusiness as any)?.address || '',
      address: (dealBusiness as any)?.address || '',
      city: (dealBusiness as any)?.city || '',
      state: (dealBusiness as any)?.state || '',
      zip: (dealBusiness as any)?.zip || '',
      business_phone: (dealBusiness as any)?.phone || '',
      business_email: (dealBusiness as any)?.email || '',
      start_date: (dealBusiness as any)?.start_date || '',
      requested_amount: deal.requested_amount || '',
      source_partner_name: sourcePartnerName,
      extraction_note: extension === 'csv' ? 'CSV uploaded and mapped from the first data row. Review/edit fields before sending if the partner file has multiple merchants or unusual headers.' : 'Fields were extracted from the partner application. Review and edit fields before generating the Elite Funding Solutions application.',
    },
  });

  const { data: upload, error: uploadRecordError } = await supabase
    .from('partner_application_uploads')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: applicationId,
      original_document_id: document.id,
      source_partner_name: sourcePartnerName || null,
      original_file_name: file.name,
      original_file_mime_type: file.type || null,
      original_file_size: file.size,
      status: 'draft_ready',
      extracted_payload: extractedPayload,
      edited_payload: extractedPayload,
      notes: notes || null,
      created_by: profile.id,
    })
    .select('*')
    .single();

  if (uploadRecordError) {
    await cleanupGeneratedApplicationArtifacts(supabase, {
      organizationId: profile.organization_id,
      storagePaths: [originalPath],
      documentIds: [document.id],
    });
    return NextResponse.json({ success: false, error: uploadRecordError.message }, { status: 500 });
  }

  await Promise.allSettled([
    supabase.from('documents').update({ related_partner_application_upload_id: upload.id }).eq('id', document.id),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: applicationId,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'document_event',
      title: 'Partner application uploaded for review',
      body: `${file.name}${sourcePartnerName ? ` from ${sourcePartnerName}` : ''} was uploaded and extracted. Review fields before generating the Elite Funding application.`,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'partner_application_uploaded_for_review',
      resource_type: 'partner_application_uploads',
      resource_id: upload.id,
      new_data: { deal_id: deal.id, document_id: document.id, converted_document_id: null, file_name: file.name, source_partner_name: sourcePartnerName || null },
    }),
  ]);

  return NextResponse.json({ success: true, applicationId, partnerApplication: upload, document, convertedDocument: null });
}
