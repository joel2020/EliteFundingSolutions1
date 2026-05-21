import { NextResponse } from 'next/server';
import { generateLenderApplicationPdf } from '@/lib/lender-application-pdf';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { decryptSensitiveField } from '@/lib/security';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

function safeDealName(value?: string | null) {
  return (value || 'merchant-application')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'merchant-application';
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const body = await request.json().catch(() => ({}));
  const partnerApplicationId = String(body.partner_application_id || '').trim() || null;

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,title,requested_amount')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const [{ data: application }, { data: business }, { data: partnerApplication }] = await Promise.all([
    deal.application_id
      ? supabase
        .from('applications')
        .select('*')
        .eq('id', deal.application_id)
        .eq('organization_id', profile.organization_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    deal.business_id
      ? supabase
        .from('businesses')
        .select('*')
        .eq('id', deal.business_id)
        .eq('organization_id', profile.organization_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    partnerApplicationId
      ? supabase
        .from('partner_application_uploads')
        .select('*')
        .eq('id', partnerApplicationId)
        .eq('organization_id', profile.organization_id)
        .eq('deal_id', deal.id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let owners: any[] = [];
  if (deal.business_id) {
    const { data: ownerLinks } = await supabase
      .from('business_owners')
      .select('is_primary,ownership_percentage,owners(id,first_name,last_name,email,phone,address,city,state,zip,dob_encrypted,ssn_encrypted,ssn_last4,ownership_percentage,credit_score_range)')
      .eq('organization_id', profile.organization_id)
      .eq('business_id', deal.business_id)
      .order('is_primary', { ascending: false });

    owners = (ownerLinks || []).map((link: any) => ({
      ...(link.owners || {}),
      ownership_percentage: link.ownership_percentage || link.owners?.ownership_percentage,
      dob_decrypted: decryptSensitiveField(link.owners?.dob_encrypted),
      ssn_decrypted: decryptSensitiveField(link.owners?.ssn_encrypted),
    }));
  }

  const editedPayload = partnerApplication?.edited_payload || {};
  const applicationForPdf = application
    ? { ...application, application_payload: { ...(application.application_payload || {}), ...editedPayload } }
    : { application_payload: editedPayload, requested_amount: deal.requested_amount };

  const pdf = await generateLenderApplicationPdf({
    deal,
    application: applicationForPdf,
    business: { ...(business || {}), legal_name: editedPayload.company_name || (business as any)?.legal_name },
    owners,
    ein: decryptSensitiveField((business as any)?.ein_encrypted) || (business as any)?.ein_last4 || null,
  });

  const fileBase = safeDealName((business as any)?.legal_name || deal.title);
  const storagePath = `${profile.organization_id}/${deal.id}/generated-applications/${Date.now()}-${fileBase}-elite-application.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('application-documents')
    .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: false });

  if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      uploaded_by_user_id: user.id,
      document_type: 'completed_application',
      label: 'Elite Funding Solutions converted application',
      file_name: `${fileBase}-elite-application.pdf`,
      file_size: pdf.length,
      mime_type: 'application/pdf',
      storage_path: storagePath,
      status: 'uploaded',
      application_source: partnerApplication ? 'partner_upload' : 'crm_manual',
      application_variant: partnerApplication ? 'elite_converted_partner' : 'elite_generated',
      related_partner_application_upload_id: partnerApplication?.id || null,
      review_notes: partnerApplication ? 'Generated from reviewed partner application fields.' : 'Generated from deal application data.',
    })
    .select('*')
    .single();

  if (documentError) return NextResponse.json({ success: false, error: documentError.message }, { status: 500 });

  await Promise.allSettled([
    partnerApplication
      ? supabase
        .from('partner_application_uploads')
        .update({ converted_document_id: document.id, status: 'converted', updated_by: profile.id })
        .eq('id', partnerApplication.id)
        .eq('organization_id', profile.organization_id)
      : Promise.resolve(),
    deal.application_id
      ? supabase
        .from('applications')
        .update({ application_review_status: partnerApplication ? 'converted_from_partner_app' : 'submitted' })
        .eq('id', deal.application_id)
        .eq('organization_id', profile.organization_id)
      : Promise.resolve(),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'document_event',
      title: 'Elite application PDF generated',
      body: document.file_name,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'elite_application_pdf_generated',
      resource_type: 'documents',
      resource_id: document.id,
      new_data: { deal_id: deal.id, application_id: deal.application_id, partner_application_upload_id: partnerApplication?.id || null },
    }),
  ]);

  return NextResponse.json({ success: true, document });
}
