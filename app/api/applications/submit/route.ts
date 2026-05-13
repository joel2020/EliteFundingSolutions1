import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';
import { emailTemplates, sendEmail } from '@/lib/email';
import { CONSENT_VERSION } from '@/lib/company';

export const dynamic = 'force-dynamic';

const ownerSchema = z.object({
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  title: z.string().optional().default(''),
  ownership_pct: z.string().optional().default(''),
  email: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  mobile: z.string().optional().default(''),
  dob: z.string().optional().default(''),
  ssn: z.string().optional().default(''),
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  zip: z.string().optional().default(''),
  credit_range: z.string().optional().default(''),
});

const existingAdvanceSchema = z.object({
  funder_name: z.string().optional().default(''),
  original_amount: z.string().optional().default(''),
  current_balance: z.string().optional().default(''),
  daily_payment: z.string().optional().default(''),
  payment_frequency: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

const applicationSchema = z.object({
  legal_name: z.string().min(2),
  dba: z.string().optional().default(''),
  entity_type: z.string().min(1),
  ein: z.string().min(1),
  merchant_type: z.string().min(1),
  industry: z.string().min(1),
  start_date: z.string().min(1),
  business_phone: z.string().min(7),
  business_mobile: z.string().optional().default(''),
  fax: z.string().optional().default(''),
  business_email: z.string().email(),
  website: z.string().optional().default(''),
  address: z.string().min(3),
  city: z.string().min(1),
  state: z.string().min(2),
  zip: z.string().min(5),
  business_location: z.string().min(1),
  products_services: z.string().min(1),
  pos_contact_name: z.string().optional().default(''),
  pos_contact_phone: z.string().optional().default(''),
  pos_system: z.string().optional().default(''),
  has_judgments: z.boolean().default(false),
  has_tax_lien: z.boolean().default(false),
  has_bankruptcy: z.boolean().default(false),
  is_seasonal: z.boolean().default(false),
  reference1_name: z.string().optional().default(''),
  reference1_phone: z.string().optional().default(''),
  reference2_name: z.string().optional().default(''),
  reference2_phone: z.string().optional().default(''),
  bank_name: z.string().min(1),
  bank_contact: z.string().optional().default(''),
  bank_phone: z.string().optional().default(''),
  account_last4: z.string().optional().default(''),
  account_type: z.string().optional().default('checking'),
  negative_days: z.string().optional().default('0'),
  nsf_count: z.string().optional().default('0'),
  ending_balance: z.string().optional().default(''),
  owner1: ownerSchema.extend({ first_name: z.string().min(1), last_name: z.string().min(1), ownership_pct: z.string().min(1), email: z.string().email(), phone: z.string().min(7), mobile: z.string().min(7), dob: z.string().min(1), ssn: z.string().min(9), address: z.string().min(1), city: z.string().min(1), state: z.string().min(2), zip: z.string().min(5) }),
  owner2: ownerSchema.default({}),
  requested_amount: z.string().min(1),
  use_of_funds: z.string().min(1),
  timeline: z.string().optional().default(''),
  average_monthly_sales: z.string().min(1),
  average_visa_mc_sales: z.string().optional().default(''),
  monthly_gross_revenue: z.string().min(1),
  has_existing_advances: z.boolean().default(false),
  notes: z.string().optional().default(''),
  existing_advances: z.array(existingAdvanceSchema).default([]),
  certification_accepted: z.literal(true),
  credit_authorization_accepted: z.literal(true),
  esign_consent_accepted: z.literal(true),
  sms_consent_accepted: z.literal(true),
  terms_accepted: z.literal(true),
  privacy_policy_accepted: z.literal(true),
  authorization_consent: z.literal(true),
  sms_consent: z.boolean().default(false),
  signature: z.string().min(2),
  signature_date: z.string().min(1),
  consent_version: z.string().optional().default(CONSENT_VERSION),
  bot_field: z.string().optional().default(''),
});

const documentKeys = ['bank_statements'] as const;
const documentLabels: Record<(typeof documentKeys)[number], string> = {
  bank_statements: 'Last 3 Bank Statements',
};

const toNumber = (value?: string) => value ? Number(value) : null;
const emptyToNull = (value?: string) => value && value.trim() ? value.trim() : null;
const submissionBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const getClientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
function isRateLimited(ip: string) {
  const now = Date.now();
  const bucket = submissionBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    submissionBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

async function readPayloadAndFiles(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const payload = formData.get('payload');
    if (typeof payload !== 'string') throw new Error('Missing application payload.');
    const files = documentKeys.flatMap((key) => formData.getAll(key).filter((entry): entry is File => entry instanceof File && entry.size > 0).map((file) => ({ key, file })));
    return { payload: JSON.parse(payload), files };
  }

  return { payload: await request.json(), files: [] as Array<{ key: (typeof documentKeys)[number]; file: File }> };
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  if (isRateLimited(clientIp)) {
    return NextResponse.json({ success: false, error: 'Too many submission attempts. Please wait and try again.' }, { status: 429 });
  }

  let parsedBody: Awaited<ReturnType<typeof readPayloadAndFiles>>;

  try {
    parsedBody = await readPayloadAndFiles(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid application payload.' }, { status: 400 });
  }

  const parsed = applicationSchema.safeParse(parsedBody.payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Please complete all required fields and authorization language.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const missingDocs = documentKeys.filter((key) => !parsedBody.files.some((item) => item.key === key));
  if (missingDocs.length > 0) {
    return NextResponse.json({ success: false, error: `Missing required uploads: ${missingDocs.map((key) => documentLabels[key]).join(', ')}` }, { status: 400 });
  }

  const form = parsed.data;
  if (form.bot_field) {
    return NextResponse.json({ success: true });
  }
  const supabase = createServiceSupabaseClient();

  try {
    const { data: biz, error: bizErr } = await supabase
      .from('businesses')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        legal_name: form.legal_name,
        dba: emptyToNull(form.dba),
        entity_type: emptyToNull(form.entity_type),
        ein_encrypted: emptyToNull(form.ein),
        industry: emptyToNull(form.industry),
        start_date: emptyToNull(form.start_date),
        phone: emptyToNull(form.business_phone),
        email: emptyToNull(form.business_email),
        website: emptyToNull(form.website),
        address: emptyToNull(form.address),
        city: emptyToNull(form.city),
        state: emptyToNull(form.state),
        zip: emptyToNull(form.zip),
        monthly_gross_revenue: toNumber(form.monthly_gross_revenue),
        current_processor: emptyToNull(form.pos_system),
        has_tax_lien: form.has_tax_lien,
        has_bankruptcy: form.has_bankruptcy,
        risk_flags: [form.has_judgments ? 'judgments' : '', form.is_seasonal ? 'seasonal' : ''].filter(Boolean),
        notes: `Merchant type: ${form.merchant_type || 'N/A'}\nProducts/services: ${form.products_services || 'N/A'}\nBusiness location: ${form.business_location || 'N/A'}`,
      })
      .select('id')
      .single();

    if (bizErr) throw bizErr;

    const createOwner = async (owner: typeof form.owner1 | typeof form.owner2, isPrimary: boolean) => {
      if (!owner.first_name || !owner.last_name) return null;
      const { data: ownerRow, error } = await supabase
        .from('owners')
        .insert({
          organization_id: DEFAULT_ORG_ID,
          first_name: owner.first_name,
          last_name: owner.last_name,
          email: emptyToNull(owner.email),
          phone: emptyToNull(owner.phone || owner.mobile),
          dob_encrypted: emptyToNull(owner.dob),
          ssn_encrypted: emptyToNull(owner.ssn),
          ownership_percentage: toNumber(owner.ownership_pct),
          credit_score_range: emptyToNull(owner.credit_range),
          address: emptyToNull(owner.address),
          city: emptyToNull(owner.city),
          state: emptyToNull(owner.state),
          zip: emptyToNull(owner.zip),
          notes: emptyToNull(owner.title ? `Title: ${owner.title}` : ''),
        })
        .select('id')
        .single();
      if (error) throw error;
      await supabase.from('business_owners').insert({ organization_id: DEFAULT_ORG_ID, business_id: biz.id, owner_id: ownerRow.id, ownership_percentage: toNumber(owner.ownership_pct), is_primary: isPrimary });
      return ownerRow;
    };

    await createOwner(form.owner1, true);
    await createOwner(form.owner2, false);

    const payloadForCrm = {
      ...form,
      bot_field: undefined,
      authorization_text_version: CONSENT_VERSION,
      consent_version: form.consent_version,
      uploaded_document_types: parsedBody.files.map((item) => item.key),
    };

    const { data: app, error: appErr } = await supabase
      .from('applications')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        business_id: biz.id,
        status: 'submitted',
        requested_amount: toNumber(form.requested_amount),
        use_of_funds: emptyToNull(form.use_of_funds),
        desired_timeline: emptyToNull(form.timeline),
        has_existing_advances: form.has_existing_advances,
        notes: emptyToNull(form.notes),
        bank_name: emptyToNull(form.bank_name),
        account_type: emptyToNull(form.account_type),
        avg_monthly_deposits: toNumber(form.average_monthly_sales),
        negative_days_count: Number(form.negative_days) || 0,
        nsf_count: Number(form.nsf_count) || 0,
        ending_balance_estimate: toNumber(form.ending_balance),
        application_payload: payloadForCrm,
        certification_accepted: form.certification_accepted,
        credit_authorization_accepted: form.credit_authorization_accepted,
        esign_consent_accepted: form.esign_consent_accepted,
        sms_consent_accepted: form.sms_consent_accepted,
        terms_accepted: form.terms_accepted,
        privacy_policy_accepted: form.privacy_policy_accepted,
        authorization_consent: form.authorization_consent,
        sms_consent: form.sms_consent_accepted,
        e_signature: form.signature,
        signed_name: form.signature,
        signature_date: form.signature_date,
        signed_at: new Date().toISOString(),
        signer_ip: clientIp,
        signer_user_agent: userAgent,
        consent_version: form.consent_version,
        ip_address: clientIp,
        user_agent: userAgent,
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (appErr) throw appErr;

    const uploadedDocuments = await Promise.all(parsedBody.files.map(async ({ key, file }) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${app.id}/${key}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('application-documents').upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;
      const { error: docError } = await supabase.from('documents').insert({
        organization_id: DEFAULT_ORG_ID,
        application_id: app.id,
        document_type: key,
        label: documentLabels[key],
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        storage_path: storagePath,
      });
      if (docError) throw docError;
      return { type: key, name: file.name, path: storagePath };
    }));

    await supabase.from('funding_requests').insert({ organization_id: DEFAULT_ORG_ID, application_id: app.id, business_id: biz.id, requested_amount: Number(form.requested_amount), use_of_funds: form.use_of_funds, credit_score_range: emptyToNull(form.owner1.credit_range), desired_timeline: emptyToNull(form.timeline), status: 'new' });
    await supabase.from('status_history').insert({ organization_id: DEFAULT_ORG_ID, application_id: app.id, previous_status: null, new_status: 'submitted', notes: 'Submitted through the secure public digital PDF application endpoint.' });
    await supabase.from('activity_logs').insert({ organization_id: DEFAULT_ORG_ID, application_id: app.id, action: 'application_submitted', resource_type: 'applications', resource_id: app.id, metadata: { source: 'digital_pdf_application', business_name: form.legal_name, documents: uploadedDocuments.map((doc) => ({ type: doc.type, name: doc.name })), consent_version: form.consent_version, signer_ip: clientIp, signer_user_agent: userAgent } });

    if (form.existing_advances.length > 0) {
      await supabase.from('existing_advances').insert(form.existing_advances.map((advance) => ({ organization_id: DEFAULT_ORG_ID, application_id: app.id, funder_name: emptyToNull(advance.funder_name), original_funded_amount: toNumber(advance.original_amount), current_balance: toNumber(advance.current_balance), daily_payment: toNumber(advance.daily_payment), payment_frequency: emptyToNull(advance.payment_frequency), notes: emptyToNull(advance.notes) })));
    }

    await supabase.from('leads').insert({ organization_id: DEFAULT_ORG_ID, lead_source: 'website', first_name: form.owner1.first_name, last_name: form.owner1.last_name, email: emptyToNull(form.owner1.email || form.business_email), phone: emptyToNull(form.owner1.phone || form.business_phone), business_name: form.legal_name, status: 'application_started', notes: `Digital application submitted for $${Number(form.requested_amount).toLocaleString()} requested funding.` });

    await Promise.allSettled([
      sendEmail({ to: form.owner1.email || form.business_email, subject: 'Elite Funding Solutions received your application', html: emailTemplates.applicationReceived(form.legal_name, Number(form.requested_amount)) }),
      sendEmail({ to: process.env.ADMIN_EMAIL || 'admin@elitefundingsolution.com', subject: `New digital funding application: ${form.legal_name}`, html: `<p>A new digital application was submitted by ${form.owner1.first_name} ${form.owner1.last_name} for ${form.legal_name}.</p><p>Requested amount: $${Number(form.requested_amount).toLocaleString()}</p><p>Documents uploaded: ${uploadedDocuments.map((doc) => doc.name).join(', ')}</p>` }),
    ]);

    return NextResponse.json({ success: true, applicationId: app.id });
  } catch (error: any) {
    console.error('Application submission failed. See server logs and Supabase audit records for details.');
    return NextResponse.json({ success: false, error: 'Application submission failed. Please contact support if this continues.' }, { status: 500 });
  }
}
