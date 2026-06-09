import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateLenderApplicationPdf } from '@/lib/lender-application-pdf';
import { loadApplicationSignaturePng } from '@/lib/pdf-signature';
import { buildPartnerApplicationPayload } from '@/lib/partner-application-fields';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { decryptSensitiveField } from '@/lib/security';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

const updateSchema = z.object({
  edited_payload: z.record(z.any()).optional(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(['uploaded','extraction_needed','draft_ready','converted','saved_to_deal','failed']).optional(),
  regenerate_pdf: z.boolean().optional(),
});

function safeDealName(value?: string | null) {
  return (value || 'merchant-application')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'merchant-application';
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid partner application update.', issues: parsed.error.flatten() }, { status: 400 });

  const { data: existing } = await supabase
    .from('partner_application_uploads')
    .select('id,organization_id,deal_id,application_id,edited_payload,notes,status')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!existing) return NextResponse.json({ success: false, error: 'Partner application not found.' }, { status: 404 });

  const nextPayload = parsed.data.edited_payload ? buildPartnerApplicationPayload(parsed.data.edited_payload) : existing.edited_payload;
  const updates = {
    ...(parsed.data.edited_payload ? { edited_payload: nextPayload } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    updated_by: profile.id,
  };

  const { data: partnerApplication, error } = await supabase
    .from('partner_application_uploads')
    .update(updates)
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  let convertedDocument: any = null;
  if (parsed.data.regenerate_pdf) {
    const { data: deal } = await supabase
      .from('deals')
      .select('id,organization_id,business_id,application_id,lead_id,title,requested_amount')
      .eq('id', existing.deal_id)
      .eq('organization_id', profile.organization_id)
      .is('deleted_at', null)
      .single();

    if (!deal) return NextResponse.json({ success: false, error: 'Deal not found for partner application.' }, { status: 404 });

    const [{ data: application }, { data: business }, { data: ownerLinks }] = await Promise.all([
      existing.application_id
        ? supabase
          .from('applications')
          .select('*')
          .eq('id', existing.application_id)
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
    const editedPayload = buildPartnerApplicationPayload(partnerApplication.edited_payload || {});
    const applicationForPdf = {
      ...(application || {}),
      application_payload: { ...((application as any)?.application_payload || {}), ...editedPayload },
      requested_amount: (application as any)?.requested_amount || deal.requested_amount,
    };
    const pdf = await generateLenderApplicationPdf({
      deal,
      application: applicationForPdf,
      business: { ...(business || {}), legal_name: editedPayload.company_name || (business as any)?.legal_name },
      owners,
      ein: decryptSensitiveField((business as any)?.ein_encrypted) || editedPayload.ein || null,
      drawnSignaturePng: await loadApplicationSignaturePng(supabase, applicationForPdf),
    });

    const fileBase = safeDealName(editedPayload.company_name || (business as any)?.legal_name || deal.title);
    const storagePath = `${profile.organization_id}/${deal.id}/generated-applications/${Date.now()}-${fileBase}-elite-application.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('application-documents')
      .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: false });

    if (uploadError) return NextResponse.json({ success: false, error: `Unable to regenerate Elite application PDF: ${uploadError.message}` }, { status: 500 });

    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert({
        organization_id: profile.organization_id,
        deal_id: deal.id,
        application_id: existing.application_id,
        uploaded_by_user_id: user.id,
        document_type: 'completed_application',
        label: 'Elite Funding Solutions converted application',
        file_name: `${fileBase}-elite-application.pdf`,
        file_size: pdf.length,
        mime_type: 'application/pdf',
        storage_path: storagePath,
        status: 'uploaded',
        application_source: 'partner_upload',
        application_variant: 'elite_converted_partner',
        related_partner_application_upload_id: existing.id,
        review_notes: 'Regenerated from reviewed partner application fields.',
      })
      .select('*')
      .single();

    if (documentError) return NextResponse.json({ success: false, error: `Unable to record regenerated Elite application PDF: ${documentError.message}` }, { status: 500 });

    convertedDocument = document;
    await supabase
      .from('partner_application_uploads')
      .update({ converted_document_id: document.id, status: 'converted', updated_by: profile.id })
      .eq('id', existing.id)
      .eq('organization_id', profile.organization_id);
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: parsed.data.regenerate_pdf ? 'partner_application_reviewed_and_regenerated' : 'partner_application_updated',
    resource_type: 'partner_application_uploads',
    resource_id: existing.id,
    old_data: { status: existing.status, notes: existing.notes, edited_payload_keys: Object.keys(existing.edited_payload || {}) },
    new_data: { status: parsed.data.regenerate_pdf ? 'converted' : partnerApplication.status, notes: partnerApplication.notes, edited_payload_keys: Object.keys(partnerApplication.edited_payload || {}), converted_document_id: convertedDocument?.id || null },
  });

  return NextResponse.json({ success: true, partnerApplication: convertedDocument ? { ...partnerApplication, status: 'converted', converted_document_id: convertedDocument.id } : partnerApplication, convertedDocument });
}
