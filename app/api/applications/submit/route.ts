import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';
import { emailTemplates, sendEmail } from '@/lib/email';
import { CONSENT_VERSION } from '@/lib/company';
import { checkPersistentRateLimit, digitsOnly, encryptSensitiveField, escapeHtml, hashSensitiveLookup, maskDigits } from '@/lib/security';

export const dynamic = 'force-dynamic';

const toNumber = (value?: string) => value ? Number(String(value).replace(/[$,]/g, '')) : null;
const emptyToNull = (value?: string) => value && value.trim() ? value.trim() : null;
const isPositiveMoney = (value?: string) => {
  const number = toNumber(value);
  return typeof number === 'number' && Number.isFinite(number) && number > 0;
};
const isValidPhone = (value?: string) => digitsOnly(value).length >= 10;
const isBlankOrValidPhone = (value?: string) => !value || digitsOnly(value).length >= 10;
const isBlankOrPositiveMoney = (value?: string) => !value || isPositiveMoney(value);
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

export const applicationSchema = z.object({
  legal_name: z.string().min(2),
  dba: z.string().optional().default(''),
  entity_type: z.string().optional().default(''),
  ein: z.string().optional().default('').transform(digitsOnly).refine((value) => value.length === 9, 'Tax ID / EIN must be 9 digits.'),
  merchant_type: z.string().optional().default(''),
  industry: z.string().trim().min(2, 'Industry is required.'),
  start_date: z.string().trim().min(1, 'Business start date is required.'),
  business_phone: z.string().optional().default('').refine(isBlankOrValidPhone, 'Business phone must be a valid U.S. phone number, or left blank.'),
  business_mobile: z.string().optional().default(''),
  fax: z.string().optional().default(''),
  business_email: z.string().optional().default('').refine((value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), 'Business email must be valid, or left blank.'),
  website: z.string().optional().default(''),
  address: z.string().trim().min(3, 'Business street address is required.'),
  city: z.string().trim().min(2, 'Business city is required.'),
  state: z.string().trim().min(2, 'Business state is required.'),
  zip: z.string().trim().min(5, 'Business ZIP is required.'),
  business_location: z.string().optional().default(''),
  products_services: z.string().optional().default(''),
  pos_contact_name: z.string().optional().default(''),
  pos_contact_phone: z.string().optional().default(''),
  pos_system: z.string().optional().default(''),
  has_judgments: z.boolean().default(false),
  has_tax_lien: z.boolean().default(false),
  has_bankruptcy: z.boolean().default(false),
  is_seasonal: z.boolean().default(false),
  bank_name: z.string().optional().default(''),
  bank_contact: z.string().optional().default(''),
  bank_phone: z.string().optional().default(''),
  account_type: z.string().optional().default('checking'),
  owner1: ownerSchema.extend({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    ownership_pct: z.string().refine((value) => { const pct = Number(value); return Number.isFinite(pct) && pct >= 0 && pct <= 100; }, 'Ownership must be between 0 and 100.'),
    email: z.string().optional().default('').refine((value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), 'Owner email must be valid, or left blank.'),
    phone: z.string().optional().default('').refine(isBlankOrValidPhone, 'Owner phone must be valid, or left blank.'),
    mobile: z.string().optional().default('').refine(isBlankOrValidPhone, 'Owner mobile phone must be valid, or left blank.'),
    dob: z.string().trim().min(1, 'Owner date of birth is required.'),
    ssn: z.string().optional().default('').transform(digitsOnly).refine((value) => value.length === 9, 'SSN must be 9 digits.'),
    address: z.string().trim().min(3, 'Owner street address is required.'),
    city: z.string().trim().min(2, 'Owner city is required.'),
    state: z.string().trim().min(2, 'Owner state is required.'),
    zip: z.string().trim().min(5, 'Owner ZIP is required.'),
  }),
  owner2: ownerSchema.default({}),
  requested_amount: z.string().trim().min(1, 'Requested funding amount is required.').refine(isPositiveMoney, 'Requested funding amount must be positive.'),
  use_of_funds: z.string().optional().default(''),
  timeline: z.string().optional().default(''),
  average_monthly_sales: z.string().optional().default('').refine(isBlankOrPositiveMoney, 'Average monthly sales must be positive, or left blank.'),
  average_visa_mc_sales: z.string().optional().default(''),
  monthly_gross_revenue: z.string().optional().default('').refine(isBlankOrPositiveMoney, 'Monthly revenue must be positive, or left blank.'),
  has_existing_advances: z.boolean().default(false),
  notes: z.string().optional().default(''),
  existing_advances: z.array(existingAdvanceSchema).default([]),
  certification_accepted: z.literal(true),
  credit_authorization_accepted: z.literal(true),
  esign_consent_accepted: z.literal(true),
  sms_consent_accepted: z.boolean().default(false),
  terms_accepted: z.literal(true),
  privacy_policy_accepted: z.literal(true),
  authorization_consent: z.literal(true),
  sms_consent: z.boolean().default(false),
  signature: z.string().optional().default(''),
  signature_date: z.string().min(1),
  consent_version: z.string().optional().default(CONSENT_VERSION),
  bot_field: z.string().optional().default(''),
  referral_code: referralCodeSchema,
  referral_path: z.string().trim().max(240).optional().default(''),
  application_source: z.string().optional().default('website'),
}).superRefine((form, ctx) => {
  if (!isValidPhone(form.owner1.mobile || form.owner1.phone)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['owner1', 'mobile'], message: 'Owner cell phone is required.' });
  }

  const owner2HasData = Object.values(form.owner2 || {}).some((value) => String(value ?? '').trim());
  if (!owner2HasData) return;
  const owner2 = form.owner2 || {};
  const requiredOwner2Fields: Array<[keyof typeof owner2, string]> = [
    ['first_name', 'Co-owner first name is required.'],
    ['last_name', 'Co-owner last name is required.'],
    ['ownership_pct', 'Co-owner ownership percentage is required.'],
    ['dob', 'Co-owner date of birth is required.'],
    ['ssn', 'Co-owner SSN is required.'],
    ['address', 'Co-owner street address is required.'],
    ['city', 'Co-owner city is required.'],
    ['state', 'Co-owner state is required.'],
    ['zip', 'Co-owner ZIP is required.'],
  ];
  for (const [field, message] of requiredOwner2Fields) {
    if (!String(owner2[field] ?? '').trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['owner2', field], message });
  }
  const pct = Number(owner2.ownership_pct);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['owner2', 'ownership_pct'], message: 'Co-owner ownership must be between 1 and 100.' });
  }
  if (digitsOnly(owner2.ssn).length !== 9) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['owner2', 'ssn'], message: 'Co-owner SSN must be 9 digits.' });
  }
  if ((owner2.mobile || owner2.phone) && !isValidPhone(owner2.mobile || owner2.phone)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['owner2', 'mobile'], message: 'Co-owner phone must be a valid U.S. phone number, or left blank.' });
  }
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

type ReferralProfile = {
  id: string;
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  referral_slug: string | null;
  referral_token?: string | null;
};

type IsoBrokerReferral = {
  id: string;
  organization_id: string;
  company_name: string;
  broker_name: string | null;
  email: string | null;
  application_slug: string | null;
  application_token?: string | null;
};

type CreatedSubmissionResources = {
  businessId?: string;
  leadId?: string;
  ownerIds: string[];
  applicationId?: string;
  dealId?: string;
  storagePaths: string[];
};

async function cleanupPartialSubmission(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  created: CreatedSubmissionResources,
) {
  await Promise.allSettled([
    created.storagePaths.length
      ? supabase.storage.from('application-documents').remove(created.storagePaths)
      : Promise.resolve(),
    created.storagePaths.length
      ? supabase.from('documents').delete().in('storage_path', created.storagePaths)
      : Promise.resolve(),
  ]);

  if (created.dealId) {
    await Promise.allSettled([
      supabase.from('deal_status_history').delete().eq('deal_id', created.dealId),
      supabase.from('activities').delete().eq('deal_id', created.dealId),
      supabase.from('deals').delete().eq('id', created.dealId),
    ]);
  }

  if (created.applicationId) {
    await Promise.allSettled([
      supabase.from('existing_advances').delete().eq('application_id', created.applicationId),
      supabase.from('documents').delete().eq('application_id', created.applicationId),
      supabase.from('activities').delete().eq('application_id', created.applicationId),
      supabase.from('applications').delete().eq('id', created.applicationId),
    ]);
  }

  if (created.ownerIds.length) {
    await Promise.allSettled([
      supabase.from('business_owners').delete().in('owner_id', created.ownerIds),
      supabase.from('owners').delete().in('id', created.ownerIds),
    ]);
  }

  if (created.leadId) {
    await supabase.from('leads').delete().eq('id', created.leadId);
  }

  if (created.businessId) {
    await Promise.allSettled([
      supabase.from('business_owners').delete().eq('business_id', created.businessId),
      supabase.from('businesses').delete().eq('id', created.businessId),
    ]);
  }
}

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
    .select('id,organization_id,email,first_name,last_name,role,referral_slug,referral_token')
    .eq('organization_id', DEFAULT_ORG_ID)
    .or(`referral_token.eq.${referralCode},referral_slug.eq.${referralCode}`)
    .eq('is_active', true)
    .is('deleted_at', null)
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
    .select('id,organization_id,company_name,broker_name,email,application_slug,application_token')
    .eq('organization_id', DEFAULT_ORG_ID)
    .or(`application_token.eq.${referralCode},application_slug.eq.${referralCode}`)
    .eq('is_active', true)
    .is('deleted_at', null)
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
    .is('deleted_at', null)
    .or('first_name.ilike.%rohan%,last_name.ilike.%rohan%,email.ilike.%rohan%')
    .limit(1)
    .maybeSingle();

  return data?.email || process.env.ADMIN_EMAIL || 'admin@elitefundingsolution.com';
}

function uniqueEmails(emails: Array<string | null | undefined>) {
  return Array.from(new Set(emails.map((email) => email?.trim().toLowerCase()).filter(Boolean))) as string[];
}

function normalizeEntityType(value?: string | null) {
  if (value === 'corporation') return 'c_corp';
  return emptyToNull(value || '');
}

function normalizeCreditRange(value?: string | null) {
  const ranges: Record<string, string> = {
    '720+': '700_749',
    '680-719': '650_699',
    '640-679': '650_699',
    '600-639': '600_649',
    '<600': '550_599',
  };
  return value ? ranges[value] || null : null;
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
  const requestedAmount = Number(form.requested_amount || 0);

  return `
    <p>A new digital application was submitted by ${escapeHtml(form.owner1.first_name)} ${escapeHtml(form.owner1.last_name)} for ${escapeHtml(form.legal_name)}.</p>
    <p><strong>Requested amount:</strong> ${requestedAmount > 0 ? `$${requestedAmount.toLocaleString()}` : 'Not provided'}</p>
    ${repLine}
    ${brokerLine}
    <p><strong>Referral code:</strong> ${escapeHtml(form.referral_code || 'none')}</p>
    <p><strong>Application ID:</strong> ${escapeHtml(appId)}</p>
    <p><strong>Deal ID:</strong> ${escapeHtml(dealId)}</p>
    <p><strong>Documents uploaded:</strong> ${escapeHtml(uploadedDocuments.map((doc) => doc.name).join(', '))}</p>
  `;
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

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' ') || '',
  };
}

function splitUsAddress(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return { address: '', city: '', state: '', zip: '' };
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  const parseStateZip = (part: string) => {
    const match = part.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/i);
    return match ? { state: match[1].toUpperCase(), zip: match[2] } : { state: '', zip: '' };
  };
  const parseInlineAddress = (part: string) => {
    const match = part.match(/^(.+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
    if (!match) return { address: part, city: '', state: '', zip: '' };
    const beforeState = match[1].trim();
    const streetMatch = beforeState.match(/^(.+\b(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|circle|cir|parkway|pkwy|place|pl|terrace|ter|trail|trl|way|highway|hwy|broadway)\b(?:\s+(?:apt|apartment|suite|ste|unit|#)\s*[\w-]+)?)\s+(.+)$/i);
    if (!streetMatch) return { address: part, city: '', state: match[2].toUpperCase(), zip: match[3] };
    return {
      address: streetMatch[1].trim(),
      city: streetMatch[2].trim(),
      state: match[2].toUpperCase(),
      zip: match[3],
    };
  };

  if (parts.length >= 3) {
    const { state, zip } = parseStateZip(parts[parts.length - 1]);
    return {
      address: parts.slice(0, -2).join(', '),
      city: parts[parts.length - 2] || '',
      state,
      zip,
    };
  }

  if (parts.length === 2) {
    const { state, zip } = parseStateZip(parts[1]);
    return { address: parts[0], city: state || zip ? '' : parts[1], state, zip };
  }

  return parseInlineAddress(raw);
}

export function normalizeIncomingPayload(payload: any) {
  if (!payload || typeof payload !== 'object' || !('full_name' in payload)) return payload;

  const ownerName = splitFullName(String(payload.full_name || ''));
  const coOwnerName = splitFullName(String(payload.co_owner_full_name || ''));
  const businessAddress = splitUsAddress(payload.business_address);
  const ownerAddress = splitUsAddress(payload.home_address);
  const coOwnerAddress = splitUsAddress(payload.co_owner_home_address);
  const hasCoOwnerData = Boolean(
    String(payload.co_owner_full_name || '').trim() ||
    String(payload.co_owner_home_address || '').trim() ||
    String(payload.co_owner_ssn || '').trim() ||
    String(payload.co_owner_dob || '').trim() ||
    String(payload.co_owner_cell_phone || '').trim() ||
    String(payload.co_owner_email || '').trim() ||
    String(payload.co_owner_ownership_percentage || '').trim(),
  );
  const consentAccepted = Boolean(payload.consent_accepted);
  const publicAdvanceInputs = [
    { funder_name: payload.existing_advance_funder, current_balance: payload.existing_advance_balance },
    { funder_name: payload.existing_advance_2_funder, current_balance: payload.existing_advance_2_balance },
    { funder_name: payload.existing_advance_3_funder, current_balance: payload.existing_advance_3_balance },
  ];
  const existingAdvances = publicAdvanceInputs
    .map((advance) => ({
      funder_name: String(advance.funder_name || '').trim(),
      current_balance: String(advance.current_balance || '').trim(),
      original_amount: '',
      daily_payment: '',
      payment_frequency: '',
      notes: 'Submitted from public application.',
    }))
    .filter((advance) => advance.funder_name || advance.current_balance)
    .slice(0, 3);
  const hasExistingAdvance = existingAdvances.length > 0;

  return {
    legal_name: String(payload.company_name || ''),
    dba: '',
    entity_type: '',
    ein: String(payload.ein || ''),
    merchant_type: '',
    industry: String(payload.industry || ''),
    start_date: String(payload.business_start_date || ''),
    business_phone: String(payload.cell_phone || ''),
    business_mobile: String(payload.cell_phone || ''),
    business_email: String(payload.email || ''),
    website: '',
    address: businessAddress.address || String(payload.business_address || ''),
    city: businessAddress.city,
    state: businessAddress.state,
    zip: businessAddress.zip,
    business_location: '',
    products_services: String(payload.industry || ''),
    pos_contact_name: '',
    pos_contact_phone: '',
    pos_system: '',
    has_judgments: false,
    has_tax_lien: false,
    has_bankruptcy: false,
    is_seasonal: false,
    bank_name: '',
    bank_contact: '',
    bank_phone: '',
    account_type: 'checking',
    owner1: {
      ...ownerName,
      title: 'Owner',
      ownership_pct: String(payload.ownership_percentage || '100').replace(/%/g, ''),
      email: String(payload.email || ''),
      phone: String(payload.cell_phone || ''),
      mobile: String(payload.cell_phone || ''),
      dob: String(payload.dob || ''),
      ssn: String(payload.ssn || ''),
      address: ownerAddress.address || String(payload.home_address || ''),
      city: ownerAddress.city,
      state: ownerAddress.state,
      zip: ownerAddress.zip,
      credit_range: '',
    },
    owner2: hasCoOwnerData ? {
      ...coOwnerName,
      title: 'Co-owner',
      ownership_pct: String(payload.co_owner_ownership_percentage || '').replace(/%/g, ''),
      email: String(payload.co_owner_email || ''),
      phone: String(payload.co_owner_cell_phone || ''),
      mobile: String(payload.co_owner_cell_phone || ''),
      dob: String(payload.co_owner_dob || ''),
      ssn: String(payload.co_owner_ssn || ''),
      address: coOwnerAddress.address || String(payload.co_owner_home_address || ''),
      city: coOwnerAddress.city,
      state: coOwnerAddress.state,
      zip: coOwnerAddress.zip,
      credit_range: '',
    } : {},
    requested_amount: String(payload.requested_amount || ''),
    use_of_funds: String(payload.use_of_funds || ''),
    timeline: '',
    average_monthly_sales: '',
    average_visa_mc_sales: '',
    monthly_gross_revenue: '',
    has_existing_advances: hasExistingAdvance,
    existing_advances: existingAdvances,
    notes: [
      'Submitted from public funding application.',
      payload.industry ? `Industry: ${payload.industry}` : '',
      payload.use_of_funds ? `Use of funds: ${payload.use_of_funds}` : '',
      ...existingAdvances.map((advance, index) => `Open advance ${index + 1}: ${[advance.funder_name, advance.current_balance].filter(Boolean).join(' - ')}`),
    ].filter(Boolean).join('\n'),
    certification_accepted: consentAccepted,
    credit_authorization_accepted: consentAccepted,
    esign_consent_accepted: consentAccepted,
    sms_consent_accepted: false,
    terms_accepted: consentAccepted,
    privacy_policy_accepted: consentAccepted,
    authorization_consent: consentAccepted,
    sms_consent: false,
    signature: String(payload.full_name || ''),
    signature_date: new Date().toISOString().slice(0, 10),
    consent_version: payload.consent_version || CONSENT_VERSION,
    bot_field: String(payload.bot_field || ''),
    referral_code: payload.referral_code || '',
    referral_path: payload.referral_path || '',
    application_source: payload.referral_code ? 'referral' : 'website',
  };
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

  const parsed = applicationSchema.safeParse(normalizeIncomingPayload(parsedBody.payload));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Please complete all required fields and authorization language.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const form = parsed.data;
  if (form.bot_field) {
    return NextResponse.json({ success: true });
  }
  const contactEmail = form.owner1.email || form.business_email;
  const contactPhone = form.owner1.mobile || form.owner1.phone || form.business_phone;
  if (!contactEmail && !contactPhone) {
    return NextResponse.json({ success: false, error: 'Please provide at least one email or phone number.' }, { status: 400 });
  }

  const referralProfile = await resolveReferralProfile(supabase, form.referral_code);
  const isoBrokerReferral = referralProfile ? null : await resolveIsoBrokerReferral(supabase, form.referral_code);
  const { data: linkedDeal } = !referralProfile && !isoBrokerReferral && form.referral_code
    ? await supabase
      .from('deals')
      .select('id,organization_id,business_id,application_id,lead_id,title,requested_amount,assigned_user_id')
      .eq('organization_id', DEFAULT_ORG_ID)
      .eq('application_link_token', form.referral_code)
      .is('deleted_at', null)
      .maybeSingle()
    : { data: null };
  const referralCode = referralProfile?.referral_token || referralProfile?.referral_slug || isoBrokerReferral?.application_token || isoBrokerReferral?.application_slug || form.referral_code || null;
  const referralPath = form.referral_path || null;
  const leadSource = isoBrokerReferral ? 'iso' : referralProfile ? 'referral' : 'website';
  const applicationSource = linkedDeal ? 'customer_completion_link' : isoBrokerReferral ? 'iso_referral' : referralProfile ? 'rep_referral' : form.application_source || 'website';

  const invalidFile = parsedBody.files.find(({ file }) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return file.size > MAX_FILE_SIZE_BYTES || (!allowedFileTypes.has(file.type) && !allowedFileExtensions.has(extension));
  });
  if (invalidFile) {
    return NextResponse.json({ success: false, error: 'Uploads must be PDF, PNG, JPG, JPEG, or HEIC files up to 10MB each.' }, { status: 400 });
  }

  const created: CreatedSubmissionResources = {
    ownerIds: [],
    storagePaths: [],
  };

  try {
    const signedName = form.signature || `${form.owner1.first_name} ${form.owner1.last_name}`.trim();
    const einHash = hashSensitiveLookup(form.ein);
    const { data: priorBusinesses } = einHash
      ? await supabase.from('businesses').select('id,legal_name').eq('organization_id', DEFAULT_ORG_ID).eq('ein_hash', einHash).limit(1)
      : { data: [] as Array<{ id: string; legal_name: string }> };
    const duplicateBusiness = priorBusinesses?.[0] || null;

    const businessPayload = {
        organization_id: DEFAULT_ORG_ID,
        legal_name: form.legal_name,
        dba: emptyToNull(form.dba),
        entity_type: normalizeEntityType(form.entity_type),
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
      };
    const { data: biz, error: bizErr } = linkedDeal?.business_id
      ? await supabase
        .from('businesses')
        .update(businessPayload)
        .eq('id', linkedDeal.business_id)
        .eq('organization_id', DEFAULT_ORG_ID)
        .select('id')
        .single()
      : await supabase
        .from('businesses')
        .insert(businessPayload)
        .select('id')
        .single();

    if (bizErr) throw bizErr;
    if (!linkedDeal?.business_id) created.businessId = biz.id;

    const { count: priorDealCount } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', DEFAULT_ORG_ID)
      .eq('business_id', duplicateBusiness?.id || biz.id);
    const submissionSequence = Number(priorDealCount || 0) + 1;

    const leadPayload = { organization_id: DEFAULT_ORG_ID, lead_source: leadSource, first_name: form.owner1.first_name, last_name: form.owner1.last_name, email: emptyToNull(contactEmail), phone: emptyToNull(contactPhone), business_name: form.legal_name, status: 'application_started', assigned_user_id: referralProfile?.id || linkedDeal?.assigned_user_id || null, referred_by_user_profile_id: referralProfile?.id || null, iso_broker_id: isoBrokerReferral?.id || null, referral_code: referralCode, referral_path: referralPath, notes: `Digital application submitted${Number(form.requested_amount || 0) > 0 ? ` for $${Number(form.requested_amount).toLocaleString()} requested funding` : ''}.${referralProfile ? ` Referred by ${profileName(referralProfile)}.` : isoBrokerReferral ? ` Referred by ${brokerName(isoBrokerReferral)}.` : linkedDeal ? ' Submitted from customer completion link.' : ''}` };
    const { data: lead, error: leadErr } = linkedDeal?.lead_id
      ? await supabase
        .from('leads')
        .update(leadPayload)
        .eq('id', linkedDeal.lead_id)
        .eq('organization_id', DEFAULT_ORG_ID)
        .select('id')
        .single()
      : await supabase
        .from('leads')
        .insert(leadPayload)
        .select('id')
        .single();
    if (leadErr) throw leadErr;
    if (!linkedDeal?.lead_id) created.leadId = lead.id;

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
          credit_score_range: normalizeCreditRange(owner.credit_range),
          address: emptyToNull(owner.address),
          city: emptyToNull(owner.city),
          state: emptyToNull(owner.state),
          zip: emptyToNull(owner.zip),
          notes: emptyToNull(owner.title ? `Title: ${owner.title}` : ''),
        })
        .select('id')
        .single();
      if (error) throw error;
      created.ownerIds.push(ownerRow.id);
      await supabase.from('business_owners').insert({ organization_id: DEFAULT_ORG_ID, business_id: biz.id, owner_id: ownerRow.id, ownership_percentage: toNumber(owner.ownership_pct), is_primary: isPrimary });
      return ownerRow;
    };

    await createOwner(form.owner1, true);
    await createOwner(form.owner2, false);

    const payloadForCrm = sanitizePayloadForCrm(form, parsedBody.files.map((item) => item.key));

    const applicationPayload = {
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
        e_signature: signedName,
        signed_name: signedName,
        signature_date: form.signature_date,
        signed_at: new Date().toISOString(),
        signer_ip: clientIp,
        signer_user_agent: userAgent,
        consent_version: form.consent_version,
        application_source: applicationSource,
        application_review_status: 'submitted',
        ip_address: clientIp,
        user_agent: userAgent,
        submitted_at: new Date().toISOString(),
      };
    const { data: app, error: appErr } = linkedDeal?.application_id
      ? await supabase
        .from('applications')
        .update(applicationPayload)
        .eq('id', linkedDeal.application_id)
        .eq('organization_id', DEFAULT_ORG_ID)
        .select('id')
        .single()
      : await supabase
        .from('applications')
        .insert(applicationPayload)
        .select('id')
        .single();

    if (appErr) throw appErr;
    if (!linkedDeal?.application_id) created.applicationId = app.id;

    const dealPayload = { organization_id: DEFAULT_ORG_ID, application_id: app.id, business_id: biz.id, lead_id: lead.id, stage_slug: 'application_submitted', title: linkedDeal?.title || `${form.legal_name} #${submissionSequence}`, requested_amount: toNumber(form.requested_amount), assigned_user_id: referralProfile?.id || linkedDeal?.assigned_user_id || null, referred_by_user_profile_id: referralProfile?.id || null, iso_broker_id: isoBrokerReferral?.id || null, lead_source: leadSource, referral_code: referralCode, referral_path: referralPath, submission_sequence: submissionSequence, duplicate_of_business_id: duplicateBusiness?.id || null, application_link_token: null, application_link_sent_at: null, notes: emptyToNull(form.notes || (referralProfile ? `Referred by ${profileName(referralProfile)}.` : isoBrokerReferral ? `Referred by ${brokerName(isoBrokerReferral)}.` : linkedDeal ? 'Customer completed missing application fields.' : duplicateBusiness ? `Repeat submission matched by EIN to ${duplicateBusiness.legal_name}.` : '')) };
    const { data: deal, error: dealErr } = linkedDeal?.id
      ? await supabase
        .from('deals')
        .update(dealPayload)
        .eq('id', linkedDeal.id)
        .eq('organization_id', DEFAULT_ORG_ID)
        .select('id')
        .single()
      : await supabase
        .from('deals')
        .insert(dealPayload)
        .select('id')
        .single();
    if (dealErr) throw dealErr;
    if (!linkedDeal?.id) created.dealId = deal.id;

    const uploadedDocuments = await Promise.all(parsedBody.files.map(async ({ key, file }) => {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${DEFAULT_ORG_ID}/${app.id}/${key}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('application-documents').upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;
      created.storagePaths.push(storagePath);
      const { error: docError } = await supabase.from('documents').insert({
        organization_id: DEFAULT_ORG_ID,
        deal_id: deal.id,
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

    await supabase.from('deal_status_history').insert({ organization_id: DEFAULT_ORG_ID, deal_id: deal.id, from_stage: null, to_stage: 'application_submitted', notes: 'Submitted through the secure public digital application endpoint.' });
    await supabase.from('activities').insert({ organization_id: DEFAULT_ORG_ID, deal_id: deal.id, application_id: app.id, business_id: biz.id, lead_id: lead.id, performed_by: referralProfile?.id || null, activity_type: 'system', title: 'Application submitted', body: `Digital funding application submitted${referralProfile ? ` from ${profileName(referralProfile)} referral link` : isoBrokerReferral ? ` from ${brokerName(isoBrokerReferral)} ISO link` : ''}. Documents uploaded: ${uploadedDocuments.length ? uploadedDocuments.map((doc) => doc.name).join(', ') : 'none yet'}` });
    await supabase.from('audit_logs').insert({ organization_id: DEFAULT_ORG_ID, action: 'application_submitted', resource_type: 'applications', resource_id: app.id, ip_address: clientIp, user_agent: userAgent, new_data: { source: isoBrokerReferral ? 'iso_broker_application' : referralProfile ? 'rep_referral_application' : 'digital_application', business_name: form.legal_name, referral_code: referralCode, referred_by_user_profile_id: referralProfile?.id || null, iso_broker_id: isoBrokerReferral?.id || null, documents: uploadedDocuments.map((doc) => ({ type: doc.type, name: doc.name })), consent_version: form.consent_version } });

    if (form.existing_advances.length > 0) {
      await supabase.from('existing_advances').insert(form.existing_advances.map((advance) => ({ organization_id: DEFAULT_ORG_ID, application_id: app.id, funder_name: emptyToNull(advance.funder_name), original_funded_amount: toNumber(advance.original_amount), current_balance: toNumber(advance.current_balance), daily_payment: toNumber(advance.daily_payment), payment_frequency: emptyToNull(advance.payment_frequency), notes: emptyToNull(advance.notes) })));
    }

    const rohanEmail = await resolveRohanEmail(supabase);
    const internalRecipients = uniqueEmails([rohanEmail, referralProfile?.email, isoBrokerReferral?.email]);
    const internalHtml = internalApplicationNotification({ form, appId: app.id, dealId: deal.id, rep: referralProfile, broker: isoBrokerReferral, uploadedDocuments });

    await Promise.allSettled([
      ...(contactEmail ? [sendEmail({ to: contactEmail, subject: 'Elite Funding Solutions received your application', html: emailTemplates.applicationReceived(form.legal_name, Number(form.requested_amount)) })] : []),
      ...internalRecipients.map((to) => sendEmail({ to, subject: `New funding application: ${form.legal_name}`, html: internalHtml })),
    ]);

    return NextResponse.json({ success: true, applicationId: app.id });
  } catch (error: any) {
    await cleanupPartialSubmission(supabase, created);
    console.error('Application submission failed.', error?.message || error);
    return NextResponse.json({ success: false, error: 'Application submission failed. Please contact support if this continues.' }, { status: 500 });
  }
}
