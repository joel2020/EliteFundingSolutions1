import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';
import { decryptSensitiveField } from '@/lib/security';
import { requireSameOrigin } from '@/lib/server-auth';
import { generateLenderApplicationPdf } from '@/lib/lender-application-pdf';

export const dynamic = 'force-dynamic';

const MAX_SIGNATURE_BYTES = 750 * 1024;

function decodePngDataUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > MAX_SIGNATURE_BYTES) return null;
  return buffer;
}

function safeDealName(value?: string | null) {
  return (value || 'merchant-application')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'merchant-application';
}

function disclosureAcceptance(application: Record<string, any>, consentVersion?: string | null) {
  const acceptedAt = application.signed_at || application.submitted_at || new Date().toISOString();
  return {
    accepted_at: acceptedAt,
    consent_version: consentVersion || application.consent_version || null,
    certification_accepted: Boolean(application.certification_accepted),
    credit_authorization_accepted: Boolean(application.credit_authorization_accepted),
    esign_consent_accepted: Boolean(application.esign_consent_accepted),
    terms_accepted: Boolean(application.terms_accepted),
    privacy_policy_accepted: Boolean(application.privacy_policy_accepted),
    authorization_consent: Boolean(application.authorization_consent),
    sms_consent_accepted: Boolean(application.sms_consent_accepted),
  };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const supabase = createServiceSupabaseClient();
  const body = await request.json().catch(() => ({}));
  const signaturePng = decodePngDataUrl(body.signature_data_url);

  if (!signaturePng) {
    return NextResponse.json({ success: false, error: 'A drawn signature is required before submission.' }, { status: 400 });
  }

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', DEFAULT_ORG_ID)
    .is('deleted_at', null)
    .maybeSingle();

  if (applicationError || !application) {
    return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
  }

  if (application.signed_application_document_id) {
    return NextResponse.json({ success: true, alreadyComplete: true, documentId: application.signed_application_document_id });
  }

  const submittedAt = application.submitted_at ? new Date(application.submitted_at).getTime() : 0;
  const isFreshSubmission = submittedAt && Date.now() - submittedAt < 1000 * 60 * 60 * 24;
  if (!isFreshSubmission) {
    return NextResponse.json({ success: false, error: 'This signature session expired. Please contact Elite Funding Solutions.' }, { status: 403 });
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('application_id', application.id)
    .eq('organization_id', DEFAULT_ORG_ID)
    .is('deleted_at', null)
    .maybeSingle();

  if (!deal) {
    return NextResponse.json({ success: false, error: 'Deal record was not created for this application.' }, { status: 500 });
  }

  const [{ data: business }, { data: ownerLinks }] = await Promise.all([
    application.business_id
      ? supabase.from('businesses').select('*').eq('id', application.business_id).eq('organization_id', DEFAULT_ORG_ID).maybeSingle()
      : Promise.resolve({ data: null }),
    application.business_id
      ? supabase
        .from('business_owners')
        .select('is_primary,ownership_percentage,owners(id,first_name,last_name,email,phone,address,city,state,zip,dob_encrypted,ssn_encrypted,ssn_last4,ownership_percentage,credit_score_range)')
        .eq('organization_id', DEFAULT_ORG_ID)
        .eq('business_id', application.business_id)
        .order('is_primary', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const owners = (ownerLinks || []).map((link: any) => ({
    ...(link.owners || {}),
    ownership_percentage: link.ownership_percentage || link.owners?.ownership_percentage,
    dob_decrypted: decryptSensitiveField(link.owners?.dob_encrypted),
    ssn_decrypted: decryptSensitiveField(link.owners?.ssn_encrypted),
  }));

  const now = new Date().toISOString();
  const fileBase = safeDealName((business as any)?.legal_name || deal.title);
  const signaturePath = `${DEFAULT_ORG_ID}/${deal.id}/signatures/${Date.now()}-${fileBase}-signature.png`;

  const { error: signatureUploadError } = await supabase.storage
    .from('application-documents')
    .upload(signaturePath, signaturePng, { contentType: 'image/png', upsert: false });

  if (signatureUploadError) {
    return NextResponse.json({ success: false, error: `Unable to save signature: ${signatureUploadError.message}` }, { status: 500 });
  }

  const applicationForPdf = {
    ...application,
    signature_type: 'drawn',
    signature_status: 'signed',
    signature_data_storage_path: signaturePath,
    application_payload: {
      ...(application.application_payload || {}),
      signature_data_url: body.signature_data_url,
      signature_type: 'drawn',
    },
  };

  const pdf = await generateLenderApplicationPdf({
    deal,
    application: applicationForPdf,
    business,
    owners,
    ein: decryptSensitiveField((business as any)?.ein_encrypted) || null,
    drawnSignaturePng: signaturePng,
  });

  const pdfPath = `${DEFAULT_ORG_ID}/${deal.id}/generated-applications/${Date.now()}-${fileBase}-signed-application.pdf`;
  const { error: pdfUploadError } = await supabase.storage
    .from('application-documents')
    .upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: false });

  if (pdfUploadError) {
    return NextResponse.json({ success: false, error: `Unable to save signed PDF: ${pdfUploadError.message}` }, { status: 500 });
  }

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .insert({
      organization_id: DEFAULT_ORG_ID,
      deal_id: deal.id,
      application_id: application.id,
      lead_id: application.lead_id,
      document_type: 'completed_application',
      label: 'Signed Elite Funding Solutions application',
      file_name: `${fileBase}-signed-elite-application.pdf`,
      file_size: pdf.length,
      mime_type: 'application/pdf',
      storage_path: pdfPath,
      status: 'uploaded',
      application_source: application.application_source || 'website',
      application_variant: 'elite_signed_website',
      visibility: 'internal',
      review_notes: 'Generated automatically from the signed website application.',
    })
    .select('id,file_name,storage_path')
    .single();

  if (documentError) {
    return NextResponse.json({ success: false, error: `Unable to attach signed PDF: ${documentError.message}` }, { status: 500 });
  }

  const acceptance = disclosureAcceptance(application, body.consent_version);
  const signatureHash = createHash('sha256')
    .update(`${application.id}:${application.signed_name || ''}:${signaturePath}:${now}`)
    .digest('hex');

  await Promise.allSettled([
    supabase
      .from('applications')
      .update({
        signature_status: 'signed',
        signature_type: 'drawn',
        signature_data_storage_path: signaturePath,
        signed_application_document_id: document.id,
        disclosure_acceptance: acceptance,
        signed_at: application.signed_at || now,
      })
      .eq('id', application.id)
      .eq('organization_id', DEFAULT_ORG_ID),
    supabase.from('application_signatures').insert({
      organization_id: DEFAULT_ORG_ID,
      application_id: application.id,
      deal_id: deal.id,
      business_id: application.business_id,
      lead_id: application.lead_id,
      document_id: document.id,
      signature_status: 'signed',
      signature_type: 'drawn',
      signature_name: application.signed_name || application.e_signature || 'Applicant',
      signature_date: application.signature_date || new Date().toISOString().slice(0, 10),
      signed_at: application.signed_at || now,
      signature_ip: application.signer_ip || application.ip_address || null,
      signature_user_agent: application.signer_user_agent || application.user_agent || null,
      consent_version: body.consent_version || application.consent_version || null,
      application_version: application.application_version || 1,
      disclosure_acceptance: acceptance,
      application_payload_snapshot: application.application_payload || {},
      signature_hash: signatureHash,
    }),
    supabase.from('activities').insert({
      organization_id: DEFAULT_ORG_ID,
      deal_id: deal.id,
      application_id: application.id,
      business_id: application.business_id,
      lead_id: application.lead_id,
      activity_type: 'document_event',
      title: 'Signed application PDF generated',
      body: document.file_name,
    }),
    supabase.from('audit_logs').insert({
      organization_id: DEFAULT_ORG_ID,
      action: 'website_application_signed_pdf_generated',
      resource_type: 'applications',
      resource_id: application.id,
      ip_address: application.ip_address || null,
      user_agent: application.user_agent || null,
      new_data: { deal_id: deal.id, document_id: document.id, signature_storage_path: signaturePath },
    }),
  ]);

  return NextResponse.json({ success: true, documentId: document.id });
}
