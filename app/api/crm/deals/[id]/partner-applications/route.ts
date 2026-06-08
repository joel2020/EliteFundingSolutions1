import { NextResponse } from 'next/server';
import { generateLenderApplicationPdf } from '@/lib/lender-application-pdf';
import { loadApplicationSignaturePng } from '@/lib/pdf-signature';
import { extractPartnerApplicationPayloadFromUpload } from '@/lib/partner-application-extraction';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { decryptSensitiveField } from '@/lib/security';

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

function safeDealName(value?: string | null) {
  return (value || 'merchant-application')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'merchant-application';
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

  if (documentError) return NextResponse.json({ success: false, error: documentError.message }, { status: 500 });

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
    extraction_note: extension === 'csv' ? 'CSV uploaded and mapped from the first data row. Review/edit fields before sending if the partner file has multiple merchants or unusual headers.' : 'Elite PDF generated from current CRM fields. Review and edit fields if the partner file has newer data.',
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

  if (uploadRecordError) return NextResponse.json({ success: false, error: uploadRecordError.message }, { status: 500 });

  const [{ data: application }, { data: business }, { data: ownerLinks }] = await Promise.all([
    supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle(),
    Promise.resolve({ data: dealBusiness }),
    deal.business_id
      ? supabase
        .from('business_owners')
        .select('is_primary,ownership_percentage,owners(id,first_name,last_name,email,phone,address,city,state,zip,dob_encrypted,ssn_encrypted,ssn_last4,ownership_percentage,credit_score_range)')
        .eq('organization_id', profile.organization_id)
        .eq('business_id', deal.business_id)
        .order('is_primary', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const owners = (ownerLinks || []).map((link: any) => ({
    ...(link.owners || {}),
    ownership_percentage: link.ownership_percentage || link.owners?.ownership_percentage,
    dob_decrypted: decryptSensitiveField(link.owners?.dob_encrypted),
    ssn_decrypted: decryptSensitiveField(link.owners?.ssn_encrypted),
  }));
  const applicationForPdf = {
    ...(application || {}),
    application_payload: { ...((application as any)?.application_payload || {}), ...extractedPayload },
    requested_amount: (application as any)?.requested_amount || deal.requested_amount,
  };
  const pdf = await generateLenderApplicationPdf({
    deal,
    application: applicationForPdf,
    business: { ...(business || {}), legal_name: extractedPayload.company_name || (business as any)?.legal_name },
    owners,
    ein: decryptSensitiveField((business as any)?.ein_encrypted) || (business as any)?.ein_last4 || null,
    drawnSignaturePng: await loadApplicationSignaturePng(supabase, applicationForPdf),
  });
  const fileBase = safeDealName((business as any)?.legal_name || deal.title);
  const convertedPath = `${profile.organization_id}/${deal.id}/generated-applications/${Date.now()}-${fileBase}-elite-application.pdf`;
  const { error: convertedUploadError } = await supabase.storage
    .from('application-documents')
    .upload(convertedPath, pdf, { contentType: 'application/pdf', upsert: false });

  if (convertedUploadError) {
    await supabase
      .from('partner_application_uploads')
      .update({ status: 'failed', updated_by: profile.id })
      .eq('id', upload.id)
      .eq('organization_id', profile.organization_id);
    return NextResponse.json({ success: false, error: `Partner app uploaded, but Elite PDF generation failed: ${convertedUploadError.message}` }, { status: 500 });
  }

  const { data: convertedDocument, error: convertedDocumentError } = await supabase
    .from('documents')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: applicationId,
      uploaded_by_user_id: user.id,
      document_type: 'completed_application',
      label: 'Elite Funding Solutions converted application',
      file_name: `${fileBase}-elite-application.pdf`,
      file_size: pdf.length,
      mime_type: 'application/pdf',
      storage_path: convertedPath,
      status: 'uploaded',
      application_source: 'partner_upload',
      application_variant: 'elite_converted_partner',
      related_partner_application_upload_id: upload.id,
      review_notes: 'Generated automatically from the uploaded partner application workflow.',
    })
    .select('*')
    .single();

  if (convertedDocumentError) {
    await supabase
      .from('partner_application_uploads')
      .update({ status: 'failed', updated_by: profile.id })
      .eq('id', upload.id)
      .eq('organization_id', profile.organization_id);
    return NextResponse.json({ success: false, error: `Partner app uploaded, but Elite PDF record failed: ${convertedDocumentError.message}` }, { status: 500 });
  }

  const { data: convertedUpload } = await supabase
    .from('partner_application_uploads')
    .update({ converted_document_id: convertedDocument.id, status: 'converted', updated_by: profile.id })
    .eq('id', upload.id)
    .eq('organization_id', profile.organization_id)
    .select('*')
    .single();

  await Promise.allSettled([
    supabase.from('documents').update({ related_partner_application_upload_id: upload.id }).eq('id', document.id),
    supabase.from('applications').update({ application_source: 'partner_upload', application_review_status: 'converted_from_partner_app', converted_from_partner_upload_id: upload.id }).eq('id', applicationId).eq('organization_id', profile.organization_id),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: applicationId,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'document_event',
      title: 'Partner application converted',
      body: `${file.name}${sourcePartnerName ? ` from ${sourcePartnerName}` : ''} was converted into an Elite Funding application.`,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'partner_application_uploaded',
      resource_type: 'partner_application_uploads',
      resource_id: upload.id,
      new_data: { deal_id: deal.id, document_id: document.id, converted_document_id: convertedDocument.id, file_name: file.name, source_partner_name: sourcePartnerName || null },
    }),
  ]);

  return NextResponse.json({ success: true, applicationId, partnerApplication: convertedUpload || upload, document, convertedDocument });
}
