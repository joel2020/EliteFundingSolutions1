import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPortalApplicationIds, requirePortalProfile, requireSameOrigin } from '@/lib/server-auth';
import { buildSignedContractPdf } from '@/lib/contract-signing-pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const signSchema = z.object({
  signature_name: z.string().trim().min(2, 'Enter your full legal name.').max(160),
  esign_consent_accepted: z.literal(true, {
    errorMap: () => ({ message: 'E-SIGN consent is required.' }),
  }),
});

const ESIGN_CONSENT_TEXT = 'I consent to use electronic records and electronic signatures for this funding contract. I agree that my typed name, timestamp, IP address, browser details, authenticated portal account, and related audit records may be used as evidence of my electronic signature and intent to sign.';

function requestIp(request: Request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unavailable'
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requirePortalProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = signSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message || 'Invalid signature payload.' }, { status: 400 });
  }

  const applicationIds = await getPortalApplicationIds(supabase, user, profile.organization_id);
  if (!applicationIds.length) {
    return NextResponse.json({ success: false, error: 'No portal application found.' }, { status: 404 });
  }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select(`
      id,
      organization_id,
      deal_id,
      offer_id,
      contract_type,
      status,
      storage_path,
      signed_storage_path,
      funded_amount,
      deals!inner(id, application_id, business_id, lead_id, stage_slug, title, businesses(legal_name, dba))
    `)
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  const deal = Array.isArray(contract?.deals) ? contract?.deals[0] : contract?.deals;
  const business = Array.isArray(deal?.businesses) ? deal?.businesses[0] : deal?.businesses;

  if (contractError || !contract || !deal || !applicationIds.includes(deal.application_id)) {
    return NextResponse.json({ success: false, error: 'Contract not found.' }, { status: 404 });
  }

  if (contract.status === 'signed') {
    return NextResponse.json({ success: false, error: 'This contract has already been signed.' }, { status: 409 });
  }

  if (!['sent', 'viewed'].includes(contract.status || '')) {
    return NextResponse.json({ success: false, error: 'This contract is not ready for signing.' }, { status: 409 });
  }

  let originalPdfBytes: Uint8Array | null = null;
  if (contract.storage_path) {
    const { data: originalFile } = await supabase.storage.from('application-documents').download(contract.storage_path);
    if (originalFile) originalPdfBytes = new Uint8Array(await originalFile.arrayBuffer());
  }

  const signedAt = new Date().toISOString();
  const signerIp = requestIp(request);
  const signerUserAgent = request.headers.get('user-agent') || 'unavailable';
  const businessName = business?.legal_name || business?.dba || deal.title || 'Funding contract';
  const signedPdf = await buildSignedContractPdf({
    originalPdfBytes,
    contractId: contract.id,
    businessName,
    contractType: contract.contract_type || 'Contract',
    signerName: parsed.data.signature_name,
    signerEmail: user.email || profile.email,
    signerUserId: user.id,
    signedAt,
    signerIp,
    signerUserAgent,
    esignConsentText: ESIGN_CONSENT_TEXT,
  });

  const storagePath = `${profile.organization_id}/${deal.application_id}/signed_contracts/${contract.id}-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('application-documents')
    .upload(storagePath, Buffer.from(signedPdf.bytes), {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'signed',
      signed_date: signedAt,
      signed_storage_path: storagePath,
    })
    .eq('id', contract.id)
    .eq('organization_id', profile.organization_id);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  await supabase
    .from('deals')
    .update({ stage_slug: 'contract_signed', updated_by: profile.id })
    .eq('id', contract.deal_id)
    .eq('organization_id', profile.organization_id);

  const { data: document } = await supabase
    .from('documents')
    .insert({
      organization_id: profile.organization_id,
      deal_id: contract.deal_id,
      application_id: deal.application_id,
      document_type: 'signed_contract',
      label: 'Signed Funding Contract',
      file_name: `${businessName.replace(/[^a-zA-Z0-9._-]/g, '_')}-signed-contract.pdf`,
      file_size: signedPdf.bytes.byteLength,
      mime_type: 'application/pdf',
      storage_path: storagePath,
      status: 'approved',
      uploaded_by_user_id: user.id,
    })
    .select('id')
    .single();

  await Promise.allSettled([
    supabase.from('deal_status_history').insert({
      organization_id: profile.organization_id,
      deal_id: contract.deal_id,
      from_stage: deal.stage_slug,
      to_stage: 'contract_signed',
      changed_by: profile.id,
      notes: 'Client electronically signed contract in portal.',
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: contract.deal_id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'contract',
      title: 'Contract signed',
      body: 'Client electronically signed the funding contract in the portal.',
      direction: 'inbound',
      performed_by: profile.id,
      resource_type: 'contracts',
      resource_id: contract.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'portal_contract_signed',
      resource_type: 'contracts',
      resource_id: contract.id,
      old_data: { status: contract.status, deal_stage: deal.stage_slug },
      new_data: {
        status: 'signed',
        deal_stage: 'contract_signed',
        document_id: document?.id || null,
        signed_at: signedAt,
        signer_email: user.email || profile.email,
        signer_ip: signerIp,
        signer_user_agent: signerUserAgent,
        original_sha256: signedPdf.originalHash,
        signed_sha256: signedPdf.signedHash,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    contract: {
      id: contract.id,
      status: 'signed',
      signed_date: signedAt,
      has_signed_file: true,
    },
  });
}
