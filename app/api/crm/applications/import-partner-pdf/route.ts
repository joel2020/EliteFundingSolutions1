import { NextResponse } from 'next/server';
import { generateEliteApplicationDocument } from '@/lib/elite-application-document';
import { extractPartnerApplicationFromPdf } from '@/lib/partner-pdf-import';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { digitsOnly, encryptSensitiveField, hashSensitiveLookup } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const IMPORT_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

function toNumber(value?: string | null) {
  if (!value) return null;
  const number = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function emptyToNull(value?: string | null) {
  return value && value.trim() ? value.trim() : null;
}

function noteFrom(data: Record<string, any>) {
  return [
    'Imported from flat partner PDF.',
    data.use_of_funds ? `Use of funds: ${data.use_of_funds}` : '',
    data.extraction_confidence < 70 ? `Review required: extraction confidence ${data.extraction_confidence}%.` : '',
  ].filter(Boolean).join('\n');
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(IMPORT_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ success: false, error: 'Invalid import payload.' }, { status: 400 });

  const file = formData.get('file');
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ success: false, error: 'Partner PDF file is required.' }, { status: 400 });
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (file.size > MAX_FILE_SIZE_BYTES || (file.type && file.type !== 'application/pdf') || extension !== 'pdf') {
    return NextResponse.json({ success: false, error: 'Upload a text-based PDF up to 15MB.' }, { status: 400 });
  }

  const pdfBuffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractPartnerApplicationFromPdf(pdfBuffer).catch((error) => {
    const message = error?.message || 'Unable to read this partner PDF.';
    return { error: message };
  });
  if ('error' in extracted) {
    return NextResponse.json({ success: false, error: extracted.error }, { status: 400 });
  }

  const ein = digitsOnly(extracted.ein);
  const ssn = digitsOnly(extracted.owner1.ssn);
  const requestedAmount = toNumber(extracted.requested_amount);
  const monthlyRevenue = toNumber(extracted.monthly_gross_revenue || extracted.average_monthly_sales);
  const ownerName = [extracted.owner1.first_name, extracted.owner1.last_name].filter(Boolean).join(' ');
  const importedAt = new Date().toISOString();
  const leadEmail = emptyToNull(extracted.owner1.email || extracted.business_email);
  const leadPhone = emptyToNull(extracted.owner1.mobile || extracted.owner1.phone || extracted.business_phone);
  const businessName = extracted.legal_name || extracted.dba || 'Imported Partner Application';

  try {
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        organization_id: profile.organization_id,
        legal_name: businessName,
        dba: emptyToNull(extracted.dba),
        entity_type: emptyToNull(extracted.entity_type),
        ein_encrypted: ein.length === 9 ? encryptSensitiveField(ein) : null,
        ein_hash: ein.length === 9 ? hashSensitiveLookup(ein) : null,
        ein_last4: ein ? ein.slice(-4) : null,
        industry: emptyToNull(extracted.industry),
        start_date: emptyToNull(extracted.start_date),
        phone: emptyToNull(extracted.business_phone),
        email: emptyToNull(extracted.business_email),
        website: emptyToNull(extracted.website),
        address: emptyToNull(extracted.address),
        city: emptyToNull(extracted.city),
        state: emptyToNull(extracted.state),
        zip: emptyToNull(extracted.zip),
        monthly_gross_revenue: monthlyRevenue,
        notes: noteFrom(extracted),
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select('id')
      .single();

    if (businessError) throw businessError;

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        organization_id: profile.organization_id,
        lead_source: 'partner',
        first_name: extracted.owner1.first_name,
        last_name: extracted.owner1.last_name,
        email: leadEmail,
        phone: leadPhone,
        business_name: businessName,
        status: 'converted',
        assigned_user_id: profile.id,
        notes: noteFrom(extracted),
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select('id')
      .single();

    if (leadError) throw leadError;

    let ownerId: string | null = null;
    if (extracted.owner1.first_name || extracted.owner1.last_name || leadEmail) {
      const { data: owner, error: ownerError } = await supabase
        .from('owners')
        .insert({
          organization_id: profile.organization_id,
          first_name: extracted.owner1.first_name,
          last_name: extracted.owner1.last_name,
          email: leadEmail,
          phone: leadPhone,
          dob_encrypted: extracted.owner1.dob ? encryptSensitiveField(extracted.owner1.dob) : null,
          ssn_encrypted: ssn.length === 9 ? encryptSensitiveField(ssn) : null,
          ssn_last4: ssn ? ssn.slice(-4) : null,
          ownership_percentage: toNumber(extracted.owner1.ownership_pct),
          address: emptyToNull(extracted.owner1.address),
          city: emptyToNull(extracted.owner1.city),
          state: emptyToNull(extracted.owner1.state),
          zip: emptyToNull(extracted.owner1.zip),
          notes: emptyToNull(extracted.owner1.title ? `Imported title: ${extracted.owner1.title}` : ''),
          created_by: profile.id,
          updated_by: profile.id,
        })
        .select('id')
        .single();

      if (ownerError) throw ownerError;
      ownerId = owner.id;

      await supabase.from('business_owners').insert({
        organization_id: profile.organization_id,
        business_id: business.id,
        owner_id: owner.id,
        ownership_percentage: toNumber(extracted.owner1.ownership_pct),
        is_primary: true,
      });
    }

    const applicationPayload = {
      ...extracted,
      ein: ein ? `*****${ein.slice(-4)}` : '',
      owner1: {
        ...extracted.owner1,
        ssn: ssn ? `*****${ssn.slice(-4)}` : '',
        dob: extracted.owner1.dob ? '[encrypted]' : '',
      },
      import_source: 'partner_pdf',
      imported_file_name: file.name,
      imported_at: importedAt,
      imported_by_user_id: user.id,
      signature_source: 'partner_pdf',
    };

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .insert({
        organization_id: profile.organization_id,
        business_id: business.id,
        lead_id: lead.id,
        status: 'submitted',
        requested_amount: requestedAmount,
        use_of_funds: emptyToNull(extracted.use_of_funds),
        has_existing_advances: false,
        notes: noteFrom(extracted),
        bank_name: emptyToNull(extracted.bank_name),
        account_type: extracted.account_type === 'savings' ? 'savings' : 'checking',
        avg_monthly_deposits: toNumber(extracted.average_monthly_sales),
        application_payload: applicationPayload,
        assigned_user_id: profile.id,
        lead_source: 'partner',
        certification_accepted: Boolean(extracted.signature),
        credit_authorization_accepted: false,
        esign_consent_accepted: Boolean(extracted.signature),
        sms_consent_accepted: false,
        terms_accepted: false,
        privacy_policy_accepted: false,
        authorization_consent: false,
        sms_consent: false,
        e_signature: emptyToNull(extracted.signature),
        signed_name: emptyToNull(extracted.signature || ownerName),
        signature_date: emptyToNull(extracted.signature_date),
        signed_at: extracted.signature ? importedAt : null,
        signer_ip: null,
        signer_user_agent: 'Imported from partner PDF by CRM user.',
        consent_version: 'partner_pdf_import',
        submitted_at: importedAt,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select('id')
      .single();

    if (applicationError) throw applicationError;

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        organization_id: profile.organization_id,
        application_id: application.id,
        business_id: business.id,
        lead_id: lead.id,
        stage_slug: 'application_submitted',
        title: `${businessName} partner import`,
        requested_amount: requestedAmount,
        assigned_user_id: profile.id,
        lead_source: 'partner',
        notes: noteFrom(extracted),
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select('id')
      .single();

    if (dealError) throw dealError;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const sourcePath = `${profile.organization_id}/${application.id}/partner-imports/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('application-documents')
      .upload(sourcePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError) throw uploadError;

    const { data: sourceDocument, error: sourceDocumentError } = await supabase
      .from('documents')
      .insert({
        organization_id: profile.organization_id,
        deal_id: deal.id,
        application_id: application.id,
        uploaded_by_user_id: user.id,
        document_type: 'signed_application',
        label: 'Imported Partner PDF Application',
        file_name: file.name,
        file_size: file.size,
        mime_type: 'application/pdf',
        storage_path: sourcePath,
        status: 'uploaded',
        review_notes: `Imported text extraction confidence: ${extracted.extraction_confidence}%.`,
      })
      .select('id')
      .single();

    if (sourceDocumentError) throw sourceDocumentError;

    const generatedEliteApplication = await generateEliteApplicationDocument({
      supabase,
      organizationId: profile.organization_id,
      dealId: deal.id,
      userId: user.id,
      profileId: profile.id,
      sourceDocumentId: sourceDocument.id,
      reason: 'Generated automatically from imported partner PDF application data and signature.',
    });

    await Promise.allSettled([
      supabase.from('deal_status_history').insert({
        organization_id: profile.organization_id,
        deal_id: deal.id,
        from_stage: null,
        to_stage: 'application_submitted',
        changed_by: profile.id,
        notes: 'Deal created from imported partner PDF application.',
      }),
      supabase.from('activities').insert({
        organization_id: profile.organization_id,
        deal_id: deal.id,
        application_id: application.id,
        business_id: business.id,
        lead_id: lead.id,
        activity_type: 'system',
        title: 'Partner PDF imported',
        body: `Created CRM records and generated Elite Funding application PDF from ${file.name}.`,
        direction: 'internal',
        performed_by: profile.id,
      }),
      supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        action: 'partner_pdf_application_imported',
        resource_type: 'applications',
        resource_id: application.id,
        new_data: {
          business_id: business.id,
          lead_id: lead.id,
          owner_id: ownerId,
          deal_id: deal.id,
          source_document_id: sourceDocument.id,
          generated_elite_application_document_id: generatedEliteApplication.generated ? generatedEliteApplication.document.id : null,
          extraction_confidence: extracted.extraction_confidence,
          signature_present: Boolean(extracted.signature),
          signature_date_present: Boolean(extracted.signature_date),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      applicationId: application.id,
      dealId: deal.id,
      businessId: business.id,
      leadId: lead.id,
      sourceDocumentId: sourceDocument.id,
      generatedEliteApplication,
      extracted: {
        business_name: businessName,
        owner_name: ownerName,
        requested_amount: requestedAmount,
        signature_present: Boolean(extracted.signature),
        signature_date: extracted.signature_date,
        extraction_confidence: extracted.extraction_confidence,
      },
    });
  } catch (error: any) {
    console.error('Partner PDF import failed.', error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || 'Partner PDF import failed.' }, { status: 500 });
  }
}
