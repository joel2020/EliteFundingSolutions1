import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';
import { emailTemplates, sendEmail } from '@/lib/email';
import { CONSENT_VERSION } from '@/lib/company';
import { checkPersistentRateLimit, digitsOnly, encryptSensitiveField, escapeHtml, hashSensitiveLookup, maskDigits } from '@/lib/security';
import { analyzeBankStatementText, enrichBankStatementAnalysisWithAzureAI, extractStatementText } from '@/lib/bank-statement-analysis';
import { generateEliteApplicationDocument } from '@/lib/elite-application-document';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const toNumber = (value?: string) => value ? Number(String(value).replace(/[$,]/g, '')) : null;
const emptyToNull = (value?: string) => value && value.trim() ? value.trim() : null;
const isPositiveMoney = (value?: string) => {
  const number = toNumber(value);
  return typeof number === 'number' && Number.isFinite(number) && number > 0;
};
const isValidPhone = (value?: string) => digitsOnly(value).length >= 10;
const allowedFileTypes = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif']);
const allowedFileExtensions = new Set(['pdf', 'png', 'jpg', 'jpeg', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const RATE_LIMIT_MAX = 5;
const creditScoreRangeSchema = z.enum(['', '720+', '680-719', '640-679', '600-639', '<600']);
const referralCodeSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : ''),
  z.union([z.literal(''), z.string().regex(/^[a-z0-9][a-z0-9._-]{0,96}$/)]),
).default('');

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
  credit_range: creditScoreRangeSchema.optional().default(''),
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
  ein: z.string().transform(digitsOnly).refine((value) => value.length === 9, 'EIN must be exactly 9 digits.'),
  merchant_type: z.string().min(1),
  industry: z.string().min(1),
  start_date: z.string().min(1),
  business_phone: z.string().refine(isValidPhone, 'Business phone must be a valid U.S. phone number.'),
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
  bank_name: z.string().min(1),
  bank_contact: z.string().optional().default(''),
  bank_phone: z.string().optional().default(''),
  account_type: z.string().optional().default('checking'),
  owner1: ownerSchema.extend({ first_name: z.string().min(1), last_name: z.string().min(1), ownership_pct: z.string().refine((value) => { const pct = Number(value); return Number.isFinite(pct) && pct >= 0 && pct <= 100; }, 'Ownership must be between 0 and 100.'), email: z.string().email(), phone: z.string().refine(isValidPhone, 'Owner phone must be valid.'), mobile: z.string().refine(isValidPhone, 'Owner mobile phone must be valid.'), dob: z.string().min(1), ssn: z.string().transform(digitsOnly).refine((value) => value.length === 9, 'SSN must be exactly 9 digits.'), address: z.string().min(1), city: z.string().min(1), state: z.string().min(2), zip: z.string().min(5) }),
  owner2: ownerSchema.default({}),
  requested_amount: z.string().refine(isPositiveMoney, 'Requested funding amount must be positive.'),
  use_of_funds: z.string().min(1),
  timeline: z.string().optional().default(''),
  average_monthly_sales: z.string().refine(isPositiveMoney, 'Average monthly sales must be positive.'),
  average_visa_mc_sales: z.string().optional().default(''),
  monthly_gross_revenue: z.string().refine(isPositiveMoney, 'Monthly revenue must be positive.'),
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
  referral_code: referralCodeSchema,
  referral_path: z.string().trim().max(240).optional().default(''),
});

const documentKeys = ['bank_statements', 'license_verification', 'other_documents'] as const;
const documentLabels: Record<(typeof documentKeys)[number], string> = {
  bank_statements: 'Business Bank Statement',
  license_verification: 'License Verification',
  other_documents: 'Other Document',
};

const getClientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

function sanitizeOwnerForPayload<T extends { ssn?: string; dob?: string }>(owner: T) {
  return {
    ...owner,
    ssn: maskDigits(owner.ssn),
    dob: owner.dob ? '[encrypted]' : '',
  };
}

function sanitizePayloadForCrm(form: z.infer<typeof applicationSchema>, uploadedTypes: string[]) {
  return {
    ...form,
    ein: maskDigits(form.ein),
    owner1: sanitizeOwnerForPayload(form.owner1),
    owner2: sanitizeOwnerForPayload(form.owner2),
    bot_field: undefined,
    authorization_text_version: CONSENT_VERSION,
    consent_version: form.consent_version,
    uploaded_document_types: uploadedTypes,
    referral_code: form.referral_code || null,
    referral_path: form.referral_path || null,
  };
}

function disclosureAcceptanceFor(form: z.infer<typeof applicationSchema>) {
  return {
    certification_accepted: form.certification_accepted,
    credit_authorization_accepted: form.credit_authorization_accepted,
    esign_consent_accepted: form.esign_consent_accepted,
    sms_consent_accepted: form.sms_consent_accepted,
    terms_accepted: form.terms_accepted,
    privacy_policy_accepted: form.privacy_policy_accepted,
    authorization_consent: form.authorization_consent,
    consent_version: form.consent_version,
  };
}

function signatureHashFor(input: unknown) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

type ReferralProfile = {
  id: string;
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  referral_slug: string | null;
};

type IsoBrokerReferral = {
  id: string;
  organization_id: string;
  company_name: string;
  broker_name: string | null;
  email: string | null;
  application_slug: string | null;
};

function profileName(profile: Pick<ReferralProfile, 'first_name' | 'last_name' | 'email'> | null | undefined) {
  if (!profile) return '';
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email;
}

function brokerName(broker: IsoBrokerReferral | null | undefined) {
  if (!broker) return '';
  return broker.broker_name ? `${broker.company_name} - ${broker.broker_name}` : broker.company_name;
}

async function resolveReferralProfile(supabase: ReturnType<typeof createServiceSupabaseClient>, referralCode: string) {
  if (!referralCode) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id,organization_id,email,first_name,last_name,role,referral_slug')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('referral_slug', referralCode)
    .eq('is_active', true)
    .in('role', ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'])
    .maybeSingle();

  if (error) {
    console.warn('Unable to resolve referral profile.', error.message);
    return null;
  }

  return (data ?? null) as ReferralProfile | null;
}

async function resolveIsoBrokerReferral(supabase: ReturnType<typeof createServiceSupabaseClient>, referralCode: string) {
  if (!referralCode) return null;

  const { data, error } = await supabase
    .from('iso_brokers')
    .select('id,organization_id,company_name,broker_name,email,application_slug')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('application_slug', referralCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.warn('Unable to resolve ISO broker referral.', error.message);
    return null;
  }

  return (data ?? null) as IsoBrokerReferral | null;
}

async function resolveRohanEmail(supabase: ReturnType<typeof createServiceSupabaseClient>) {
  if (process.env.ROHAN_SUPERADMIN_EMAIL) return process.env.ROHAN_SUPERADMIN_EMAIL;

  const { data } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('role', 'super_admin')
    .eq('is_active', true)
    .or('first_name.ilike.%rohan%,last_name.ilike.%rohan%,email.ilike.%rohan%')
    .limit(1)
    .maybeSingle();

  return data?.email || process.env.ADMIN_EMAIL || 'rbedi@elitefundingsol.com';
}

function uniqueEmails(emails: Array<string | null | undefined>) {
  return Array.from(new Set(emails.map((email) => email?.trim().toLowerCase()).filter(Boolean))) as string[];
}

function internalApplicationNotification({
  form,
  appId,
  dealId,
  rep,
  broker,
  uploadedDocuments,
}: {
  form: z.infer<typeof applicationSchema>;
  appId: string;
  dealId: string;
  rep: ReferralProfile | null;
  broker: IsoBrokerReferral | null;
  uploadedDocuments: Array<{ name: string }>;
}) {
  const repLine = rep
    ? `<p><strong>Assigned rep:</strong> ${escapeHtml(profileName(rep))} (${escapeHtml(rep.email)})</p>`
    : '<p><strong>Assigned rep:</strong> No referral rep matched this submission.</p>';
  const brokerLine = broker
    ? `<p><strong>ISO / broker:</strong> ${escapeHtml(brokerName(broker))}${broker.email ? ` (${escapeHtml(broker.email)})` : ''}</p>`
    : '';

  return `
    <p>A new digital application was submitted by ${escapeHtml(form.owner1.first_name)} ${escapeHtml(form.owner1.last_name)} for ${escapeHtml(form.legal_name)}.</p>
    <p><strong>Requested amount:</strong> $${Number(form.requested_amount).toLocaleString()}</p>
    ${repLine}
    ${brokerLine}
    <p><strong>Referral code:</strong> ${escapeHtml(form.referral_code || 'none')}</p>
    <p><strong>Application ID:</strong> ${escapeHtml(appId)}</p>
    <p><strong>Deal ID:</strong> ${escapeHtml(dealId)}</p>
    <p><strong>Documents uploaded:</strong> ${escapeHtml(uploadedDocuments.map((doc) => doc.name).join(', '))}</p>
  `;
}

type UploadedApplicationDocument = {
  type: (typeof documentKeys)[number];
  name: string;
  path: string;
  documentId: string;
  file: File;
};

async function runAutomaticBankStatementAnalysis({
  supabase,
  deal,
  appId,
  businessId,
  leadId,
  uploadedDocuments,
}: {
  supabase: ReturnType<typeof createServiceSupabaseClient>;
  deal: { id: string };
  appId: string;
  businessId: string;
  leadId: string;
  uploadedDocuments: UploadedApplicationDocument[];
}) {
  const bankDocuments = uploadedDocuments.filter((doc) => doc.type === 'bank_statements');
  if (!bankDocuments.length) return { analyzed: false, reason: 'No bank statements were uploaded.' };

  const texts: string[] = [];
  const extractionModes: string[] = [];

  for (const doc of bankDocuments) {
    const bytes = Buffer.from(await doc.file.arrayBuffer());
    const extracted = await extractStatementText(bytes, doc.file.type, doc.name);
    texts.push(extracted.text);
    extractionModes.push(`${doc.name}: ${extracted.mode}`);
  }

  const analysis = await enrichBankStatementAnalysisWithAzureAI(texts, analyzeBankStatementText(texts));

  const { data: financial, error: financialError } = await supabase
    .from('deal_financials')
    .upsert({
      organization_id: DEFAULT_ORG_ID,
      deal_id: deal.id,
      total_deposits: analysis.total_deposits,
      total_withdrawals: analysis.total_withdrawals,
      net_cash_flow: analysis.net_cash_flow,
      average_daily_ledger_balance: analysis.average_daily_ledger_balance,
      negative_balance_days_per_month: analysis.negative_balance_days_per_month,
      nsf_count: analysis.nsf_count,
      analysis_status: 'completed',
      analysis_confidence: analysis.confidence,
      analysis_summary: analysis.ai_summary || analysis.extraction_notes,
      analyzed_at: new Date().toISOString(),
      analyzed_by: null,
    }, { onConflict: 'organization_id,deal_id' })
    .select('id')
    .single();

  if (financialError) throw financialError;

  await supabase
    .from('current_positions')
    .delete()
    .eq('organization_id', DEFAULT_ORG_ID)
    .eq('deal_id', deal.id)
    .eq('source', 'ai_bank_analysis');

  if (analysis.detected_positions.length) {
    const { error: positionError } = await supabase.from('current_positions').insert(analysis.detected_positions.map((position) => ({
      organization_id: DEFAULT_ORG_ID,
      deal_id: deal.id,
      business_id: businessId,
      funder_name: position.funder_name,
      current_balance: null,
      daily_payment: position.payment_frequency === 'daily' ? position.payment_amount : null,
      weekly_payment: position.payment_frequency === 'weekly' ? position.payment_amount : null,
      payment_frequency: position.payment_frequency,
      status: 'active',
      source: 'ai_bank_analysis',
      recurrence_pattern: position.payment_frequency,
      occurrences: position.occurrences,
      confidence: position.confidence,
      first_seen: position.first_seen,
      last_seen: position.last_seen,
      notes: 'Auto-detected from public application bank statement upload.',
    })));
    if (positionError) throw positionError;
  }

  const { data: analysisRow, error: analysisError } = await supabase
    .from('bank_statement_analyses')
    .insert({
      organization_id: DEFAULT_ORG_ID,
      deal_id: deal.id,
      business_id: businessId,
      application_id: appId,
      status: 'completed',
      total_deposits: analysis.total_deposits,
      total_withdrawals: analysis.total_withdrawals,
      net_cash_flow: analysis.net_cash_flow,
      average_daily_ledger_balance: analysis.average_daily_ledger_balance,
      negative_balance_days_per_month: analysis.negative_balance_days_per_month,
      nsf_count: analysis.nsf_count,
      position_count: analysis.position_count,
      detected_positions: analysis.detected_positions,
      source_document_ids: bankDocuments.map((doc) => doc.documentId),
      extraction_notes: `${analysis.extraction_notes} Extraction modes: ${extractionModes.join('; ')}`,
      confidence: analysis.confidence,
      raw_metrics: {
        transactionsParsed: analysis.transactions.length,
        financial_id: financial.id,
        trigger: 'application_submit',
        ai_provider: analysis.ai_provider || null,
        ai_summary: analysis.ai_summary || null,
        ai_risk_flags: analysis.ai_risk_flags || [],
        ai_underwriting_notes: analysis.ai_underwriting_notes || [],
        ai_lender_match_notes: analysis.ai_lender_match_notes || [],
      },
      created_by: null,
    })
    .select('id')
    .single();

  if (analysisError) throw analysisError;

  await supabase.from('activities').insert({
    organization_id: DEFAULT_ORG_ID,
    deal_id: deal.id,
    application_id: appId,
    business_id: businessId,
    lead_id: leadId,
    activity_type: 'ai_analysis',
    title: 'AI bank statement analysis completed',
    body: `${analysis.position_count} position(s), ${analysis.nsf_count} NSF item(s), net cash flow $${analysis.net_cash_flow.toLocaleString()}.`,
    performed_by: null,
  });

  return { analyzed: true, analysisId: analysisRow.id, positionCount: analysis.position_count };
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
  const supabase = createServiceSupabaseClient();

  try {
    if (await checkPersistentRateLimit(supabase, `application:${clientIp}`, RATE_LIMIT_MAX)) {
      return NextResponse.json({ success: false, error: 'Too many submission attempts. Please wait and try again.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to validate submission rate. Please try again shortly.' }, { status: 503 });
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

  const form = parsed.data;
  if (form.bot_field) {
    return NextResponse.json({ success: true });
  }

  const referralProfile = await resolveReferralProfile(supabase, form.referral_code);
  const isoBrokerReferral = referralProfile ? null : await resolveIsoBrokerReferral(supabase, form.referral_code);
  const referralCode = referralProfile?.referral_slug || form.referral_code || null;
  const referralPath = form.referral_path || null;
  const leadSource = isoBrokerReferral ? 'iso' : referralProfile ? 'referral' : 'website';

  const bankStatementFiles = parsedBody.files.filter((item) => item.key === 'bank_statements');
  if (bankStatementFiles.length < 1) {
    return NextResponse.json({ success: false, error: 'Please upload your three most recent business bank statements as one combined PDF or separate files.' }, { status: 400 });
  }

  const invalidFile = parsedBody.files.find(({ file }) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return file.size > MAX_FILE_SIZE_BYTES || (!allowedFileTypes.has(file.type) && !allowedFileExtensions.has(extension));
  });
  if (invalidFile) {
    return NextResponse.json({ success: false, error: 'Uploads must be PDF, PNG, JPG, JPEG, or HEIC files up to 10MB each.' }, { status: 400 });
  }

  try {
    const einHash = hashSensitiveLookup(form.ein);
    const { data: priorBusinesses } = einHash
      ? await supabase.from('businesses').select('id,legal_name').eq('organization_id', DEFAULT_ORG_ID).eq('ein_hash', einHash).limit(1)
      : { data: [] as Array<{ id: string; legal_name: string }> };
    const duplicateBusiness = priorBusinesses?.[0] || null;

    const { data: biz, error: bizErr } = await supabase
      .from('businesses')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        legal_name: form.legal_name,
        dba: emptyToNull(form.dba),
        entity_type: emptyToNull(form.entity_type),
        ein_encrypted: encryptSensitiveField(form.ein),
        ein_hash: einHash,
        ein_last4: form.ein.slice(-4),
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

    const { count: priorDealCount } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', DEFAULT_ORG_ID)
      .eq('business_id', duplicateBusiness?.id || biz.id);
    const submissionSequence = Number(priorDealCount || 0) + 1;

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({ organization_id: DEFAULT_ORG_ID, lead_source: leadSource, first_name: form.owner1.first_name, last_name: form.owner1.last_name, email: emptyToNull(form.owner1.email || form.business_email), phone: emptyToNull(form.owner1.mobile || form.owner1.phone || form.business_phone), business_name: form.legal_name, status: 'application_started', assigned_user_id: referralProfile?.id || null, referred_by_user_profile_id: referralProfile?.id || null, iso_broker_id: isoBrokerReferral?.id || null, referral_code: referralCode, referral_path: referralPath, notes: `Digital application submitted for $${Number(form.requested_amount).toLocaleString()} requested funding.${referralProfile ? ` Referred by ${profileName(referralProfile)}.` : isoBrokerReferral ? ` Referred by ${brokerName(isoBrokerReferral)}.` : ''}` })
      .select('id')
      .single();
    if (leadErr) throw leadErr;

    const createOwner = async (owner: typeof form.owner1 | typeof form.owner2, isPrimary: boolean) => {
      if (!owner.first_name || !owner.last_name) return null;
      const ownerSsn = digitsOnly(owner.ssn);
      const { data: ownerRow, error } = await supabase
        .from('owners')
        .insert({
          organization_id: DEFAULT_ORG_ID,
          first_name: owner.first_name,
          last_name: owner.last_name,
          email: emptyToNull(owner.email),
          phone: emptyToNull(owner.mobile || owner.phone),
          dob_encrypted: encryptSensitiveField(owner.dob),
          ssn_encrypted: encryptSensitiveField(ownerSsn),
          ssn_last4: ownerSsn ? ownerSsn.slice(-4) : null,
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

    const payloadForCrm = sanitizePayloadForCrm(form, parsedBody.files.map((item) => item.key));
    const disclosureAcceptance = disclosureAcceptanceFor(form);
    const signedAt = new Date().toISOString();

    const { data: app, error: appErr } = await supabase
      .from('applications')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        business_id: biz.id,
        lead_id: lead.id,
        status: 'submitted',
        requested_amount: toNumber(form.requested_amount),
        use_of_funds: emptyToNull(form.use_of_funds),
        desired_timeline: emptyToNull(form.timeline),
        has_existing_advances: form.has_existing_advances,
        notes: emptyToNull(form.notes),
        bank_name: emptyToNull(form.bank_name),
        account_type: emptyToNull(form.account_type),
        avg_monthly_deposits: toNumber(form.average_monthly_sales),
        application_payload: payloadForCrm,
        assigned_user_id: referralProfile?.id || null,
        referred_by_user_profile_id: referralProfile?.id || null,
        iso_broker_id: isoBrokerReferral?.id || null,
        lead_source: leadSource,
        referral_code: referralCode,
        referral_path: referralPath,
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
        signed_at: signedAt,
        signer_ip: clientIp,
        signer_user_agent: userAgent,
        consent_version: form.consent_version,
        signature_status: 'signed',
        signature_type: 'typed',
        disclosure_acceptance: disclosureAcceptance,
        application_version: 1,
        ip_address: clientIp,
        user_agent: userAgent,
        submitted_at: signedAt,
      })
      .select('id')
      .single();

    if (appErr) throw appErr;

    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .insert({ organization_id: DEFAULT_ORG_ID, application_id: app.id, business_id: biz.id, lead_id: lead.id, stage_slug: 'application_submitted', title: `${form.legal_name} #${submissionSequence}`, requested_amount: toNumber(form.requested_amount), assigned_user_id: referralProfile?.id || null, referred_by_user_profile_id: referralProfile?.id || null, iso_broker_id: isoBrokerReferral?.id || null, lead_source: leadSource, referral_code: referralCode, referral_path: referralPath, submission_sequence: submissionSequence, duplicate_of_business_id: duplicateBusiness?.id || null, notes: emptyToNull(form.notes || (referralProfile ? `Referred by ${profileName(referralProfile)}.` : isoBrokerReferral ? `Referred by ${brokerName(isoBrokerReferral)}.` : duplicateBusiness ? `Repeat submission matched by EIN to ${duplicateBusiness.legal_name}.` : '')) })
      .select('id')
      .single();
    if (dealErr) throw dealErr;

    const uploadedDocuments = await Promise.all(parsedBody.files.map(async ({ key, file }) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${DEFAULT_ORG_ID}/${app.id}/${key}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('application-documents').upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;
      const { data: document, error: docError } = await supabase.from('documents').insert({
        organization_id: DEFAULT_ORG_ID,
        deal_id: deal.id,
        application_id: app.id,
        document_type: key,
        label: documentLabels[key],
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        storage_path: storagePath,
      }).select('id').single();
      if (docError) throw docError;
      return { type: key, name: file.name, path: storagePath, documentId: document.id, file };
    }));

    const generatedSignedApplication = await generateEliteApplicationDocument({
      supabase,
      organizationId: DEFAULT_ORG_ID,
      dealId: deal.id,
      userId: null,
      profileId: null,
      reason: 'Generated automatically from signed website funding application submission.',
    });

    if (generatedSignedApplication.generated) {
      await supabase
        .from('applications')
        .update({
          signed_application_document_id: generatedSignedApplication.document.id,
          signature_data_storage_path: generatedSignedApplication.document.storage_path,
        })
        .eq('id', app.id)
        .eq('organization_id', DEFAULT_ORG_ID);
    }

    const signatureEvidence = {
      application_id: app.id,
      deal_id: deal.id,
      business_id: biz.id,
      lead_id: lead.id,
      signature_name: form.signature,
      signature_date: form.signature_date,
      signed_at: signedAt,
      signature_ip: clientIp,
      signature_user_agent: userAgent,
      consent_version: form.consent_version,
      application_version: 1,
      disclosure_acceptance: disclosureAcceptance,
      application_payload_snapshot: payloadForCrm,
      document_id: generatedSignedApplication.generated ? generatedSignedApplication.document.id : null,
    };

    const { error: signatureError } = await supabase.from('application_signatures').insert({
      organization_id: DEFAULT_ORG_ID,
      application_id: app.id,
      deal_id: deal.id,
      business_id: biz.id,
      lead_id: lead.id,
      document_id: generatedSignedApplication.generated ? generatedSignedApplication.document.id : null,
      signature_status: 'signed',
      signature_type: 'typed',
      signature_name: form.signature,
      signature_date: form.signature_date,
      signed_at: signedAt,
      signature_ip: clientIp,
      signature_user_agent: userAgent,
      consent_version: form.consent_version,
      application_version: 1,
      disclosure_acceptance: disclosureAcceptance,
      application_payload_snapshot: payloadForCrm,
      signature_hash: signatureHashFor(signatureEvidence),
    });

    if (signatureError) throw signatureError;

    const automaticAnalysis = await runAutomaticBankStatementAnalysis({
      supabase,
      deal,
      appId: app.id,
      businessId: biz.id,
      leadId: lead.id,
      uploadedDocuments,
    }).catch((error) => {
      console.warn('Automatic bank statement analysis failed.', error?.message || error);
      return { analyzed: false, reason: error?.message || 'Automatic bank statement analysis failed.' };
    });

    await supabase.from('deal_status_history').insert({ organization_id: DEFAULT_ORG_ID, deal_id: deal.id, from_stage: null, to_stage: 'application_submitted', notes: 'Submitted through the secure public digital application endpoint with captured E-SIGN evidence.' });
    await supabase.from('activities').insert({ organization_id: DEFAULT_ORG_ID, deal_id: deal.id, application_id: app.id, business_id: biz.id, lead_id: lead.id, performed_by: referralProfile?.id || null, activity_type: 'system', title: 'Signed application submitted', body: `Digital funding application signed by ${form.signature} and submitted${referralProfile ? ` from ${profileName(referralProfile)} referral link` : isoBrokerReferral ? ` from ${brokerName(isoBrokerReferral)} ISO link` : ''}. Documents uploaded: ${uploadedDocuments.map((doc) => doc.name).join(', ')}` });
    await supabase.from('audit_logs').insert({ organization_id: DEFAULT_ORG_ID, action: 'application_signed_and_submitted', resource_type: 'applications', resource_id: app.id, ip_address: clientIp, user_agent: userAgent, new_data: { source: isoBrokerReferral ? 'iso_broker_application' : referralProfile ? 'rep_referral_application' : 'digital_application', business_name: form.legal_name, referral_code: referralCode, referred_by_user_profile_id: referralProfile?.id || null, iso_broker_id: isoBrokerReferral?.id || null, documents: uploadedDocuments.map((doc) => ({ type: doc.type, name: doc.name, id: doc.documentId })), signed_application_document_id: generatedSignedApplication.generated ? generatedSignedApplication.document.id : null, signature_status: 'signed', signature_type: 'typed', consent_version: form.consent_version, application_version: 1, automatic_bank_statement_analysis: automaticAnalysis } });

    if (form.existing_advances.length > 0) {
      await supabase.from('existing_advances').insert(form.existing_advances.map((advance) => ({ organization_id: DEFAULT_ORG_ID, application_id: app.id, funder_name: emptyToNull(advance.funder_name), original_funded_amount: toNumber(advance.original_amount), current_balance: toNumber(advance.current_balance), daily_payment: toNumber(advance.daily_payment), payment_frequency: emptyToNull(advance.payment_frequency), notes: emptyToNull(advance.notes) })));
    }

    const rohanEmail = await resolveRohanEmail(supabase);
    const internalRecipients = uniqueEmails([rohanEmail, referralProfile?.email, isoBrokerReferral?.email]);
    const internalHtml = internalApplicationNotification({ form, appId: app.id, dealId: deal.id, rep: referralProfile, broker: isoBrokerReferral, uploadedDocuments });

    await Promise.allSettled([
      sendEmail({ to: form.owner1.email || form.business_email, subject: 'Elite Funding Solutions received your application', html: emailTemplates.applicationReceived(form.legal_name, Number(form.requested_amount)) }),
      ...internalRecipients.map((to) => sendEmail({ to, subject: `New funding application: ${form.legal_name}`, html: internalHtml })),
    ]);

    return NextResponse.json({ success: true, applicationId: app.id });
  } catch (error: any) {
    console.error('Application submission failed.', error?.message || error);
    return NextResponse.json({ success: false, error: 'Application submission failed. Please contact support if this continues.' }, { status: 500 });
  }
}
