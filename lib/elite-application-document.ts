import { decryptSensitiveField } from '@/lib/security';
import { generateLenderApplicationPdf } from '@/lib/lender-application-pdf';
import type { createServiceSupabaseClient } from '@/lib/server-supabase';

type ServiceSupabase = ReturnType<typeof createServiceSupabaseClient>;

type GenerateEliteApplicationDocumentInput = {
  supabase: ServiceSupabase;
  organizationId: string;
  dealId: string;
  userId?: string | null;
  profileId?: string | null;
  sourceDocumentId?: string | null;
  reason?: string;
};

function safeFileBase(value: string | null | undefined) {
  return (value || 'merchant-application')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'merchant-application';
}

export async function generateEliteApplicationDocument(input: GenerateEliteApplicationDocumentInput) {
  const { supabase, organizationId, dealId, userId, profileId, sourceDocumentId, reason } = input;

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,title,requested_amount,approved_amount')
    .eq('id', dealId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!deal?.application_id) {
    return { generated: false as const, reason: 'No CRM application is linked to this deal.' };
  }

  const [{ data: application }, { data: business }] = await Promise.all([
    supabase
      .from('applications')
      .select('id,organization_id,business_id,requested_amount,has_existing_advances,bank_name,account_type,submitted_at,signed_name,signature_date,application_payload')
      .eq('id', deal.application_id)
      .eq('organization_id', organizationId)
      .maybeSingle(),
    deal.business_id
      ? supabase
        .from('businesses')
        .select('id,organization_id,legal_name,dba,entity_type,ein_encrypted,ein_last4,industry,start_date,phone,email,website,address,city,state,zip,monthly_gross_revenue,has_tax_lien,has_bankruptcy')
        .eq('id', deal.business_id)
        .eq('organization_id', organizationId)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!application) {
    return { generated: false as const, reason: 'CRM application data was not found for this deal.' };
  }

  let owners: any[] = [];
  if (deal.business_id) {
    const { data: ownerLinks } = await supabase
      .from('business_owners')
      .select('is_primary,ownership_percentage,owners(id,first_name,last_name,email,phone,address,city,state,zip,dob_encrypted,ssn_encrypted,ssn_last4,ownership_percentage,credit_score_range)')
      .eq('organization_id', organizationId)
      .eq('business_id', deal.business_id)
      .order('is_primary', { ascending: false });

    owners = (ownerLinks || []).map((link: any) => ({
      ...(link.owners || {}),
      ownership_percentage: link.ownership_percentage || link.owners?.ownership_percentage,
      dob_decrypted: decryptSensitiveField(link.owners?.dob_encrypted),
      ssn_decrypted: decryptSensitiveField(link.owners?.ssn_encrypted),
    }));
  }

  const applicationPdf = await generateLenderApplicationPdf({
    deal,
    application,
    business,
    owners,
    ein: decryptSensitiveField((business as any)?.ein_encrypted) || (business as any)?.ein_last4 || null,
  });

  const safeDealName = safeFileBase(deal.title || (business as any)?.legal_name);
  const storagePath = `${organizationId}/${deal.id}/generated-applications/${Date.now()}-${safeDealName}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('application-documents')
    .upload(storagePath, applicationPdf, { contentType: 'application/pdf', upsert: false });

  if (uploadError) {
    throw new Error(`Unable to generate Elite Funding application PDF: ${uploadError.message}`);
  }

  const { data: generatedDocument, error: documentError } = await supabase
    .from('documents')
    .insert({
      organization_id: organizationId,
      deal_id: deal.id,
      application_id: deal.application_id,
      uploaded_by_user_id: userId || null,
      document_type: 'completed_application',
      label: 'Elite Funding PDF Application',
      file_name: `${safeDealName}-elite-application.pdf`,
      file_size: applicationPdf.length,
      mime_type: 'application/pdf',
      storage_path: storagePath,
      status: 'uploaded',
      review_notes: reason || 'Generated automatically from CRM application data and signature.',
    })
    .select('id,file_name,document_type,label,status,deal_id,application_id,storage_path,mime_type,file_size')
    .single();

  if (documentError) {
    throw new Error(`Unable to record Elite Funding application PDF: ${documentError.message}`);
  }

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: organizationId,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'document_event',
      title: 'Elite Funding application generated',
      body: 'Generated from CRM application data and captured signature.',
      performed_by: profileId || null,
      resource_type: 'documents',
      resource_id: generatedDocument.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: organizationId,
      user_id: userId,
      action: 'elite_application_pdf_generated',
      resource_type: 'documents',
      resource_id: generatedDocument.id,
      new_data: {
        deal_id: deal.id,
        application_id: deal.application_id,
        source_document_id: sourceDocumentId || null,
        signed_name_present: Boolean(application.signed_name || application.application_payload?.signature),
        signature_date_present: Boolean(application.signature_date || application.application_payload?.signature_date),
      },
    }),
  ]);

  return { generated: true as const, document: generatedDocument };
}
