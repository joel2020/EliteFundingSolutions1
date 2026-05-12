import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DEFAULT_ORG_ID } from '@/lib/supabase';
import { createSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { encryptSensitiveField, getLastFour } from '@/lib/server/secure-fields';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);

const applicationSchema = z.object({
  legal_name: z.string().trim().min(2),
  dba: z.string().trim().optional().nullable(),
  entity_type: z.string().trim().min(1),
  ein: z.string().trim().min(9),
  industry: z.string().trim().min(1),
  naics_code: z.string().trim().optional().nullable(),
  start_date: z.string().trim().min(1),
  business_phone: z.string().trim().min(7),
  business_email: z.string().trim().email(),
  website: z.string().trim().optional().nullable(),
  address: z.string().trim().min(3),
  city: z.string().trim().min(2),
  state: z.string().trim().length(2),
  zip: z.string().trim().min(5),
  monthly_gross_revenue: z.coerce.number().positive(),
  deposit_count: z.coerce.number().int().nonnegative().optional().nullable(),
  current_processor: z.string().trim().optional().nullable(),
  landlord_name: z.string().trim().optional().nullable(),
  landlord_phone: z.string().trim().optional().nullable(),
  rent_amount: z.coerce.number().nonnegative().optional().nullable(),
  has_tax_lien: z.coerce.boolean(),
  has_bankruptcy: z.coerce.boolean(),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7),
  dob: z.string().trim().min(1),
  ssn_full: z.string().trim().regex(/^\d{3}-?\d{2}-?\d{4}$/),
  ownership_pct: z.coerce.number().min(0).max(100),
  credit_range: z.string().trim().optional().nullable(),
  home_address: z.string().trim().min(3),
  home_city: z.string().trim().min(2),
  home_state: z.string().trim().length(2),
  home_zip: z.string().trim().min(5),
  requested_amount: z.coerce.number().min(10000).max(5000000),
  use_of_funds: z.string().trim().optional().nullable(),
  timeline: z.string().trim().optional().nullable(),
  has_existing_advances: z.coerce.boolean(),
  payment_frequency: z.string().trim().optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  existing_advances: z.array(z.object({
    funder_name: z.string().trim().optional().nullable(),
    original_amount: z.coerce.number().nonnegative().optional().nullable(),
    current_balance: z.coerce.number().nonnegative().optional().nullable(),
    daily_payment: z.coerce.number().nonnegative().optional().nullable(),
    payment_frequency: z.string().trim().optional().nullable(),
    notes: z.string().trim().optional().nullable(),
  })).default([]),
  bank_name: z.string().trim().min(2),
  account_type: z.string().trim().optional().nullable(),
  routing_number: z.string().trim().regex(/^\d{9}$/).optional().nullable(),
  account_last4: z.string().trim().regex(/^\d{4}$/).optional().nullable(),
  avg_monthly_deposits: z.coerce.number().nonnegative().optional().nullable(),
  ending_balance: z.coerce.number().optional().nullable(),
  consent_authorized: z.literal(true),
});

function nullableNumber(value?: number | null) {
  return Number.isFinite(value) ? value : null;
}

function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const rawPayload = formData.get('payload');

    if (typeof rawPayload !== 'string') {
      return NextResponse.json({ error: 'Missing application payload.' }, { status: 400 });
    }

    const parsed = applicationSchema.safeParse(JSON.parse(rawPayload));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please review the highlighted fields and try again.', issues: parsed.error.flatten() }, { status: 400 });
    }

    const files = formData.getAll('documents').filter((value): value is File => value instanceof File && value.size > 0);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `${file.name} exceeds the 25MB file limit.` }, { status: 400 });
      }
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json({ error: `${file.name} is not an accepted file type.` }, { status: 400 });
      }
    }

    const data = parsed.data;
    const supabase = createSupabaseAdminClient();

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        lead_source: 'website',
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        business_name: data.legal_name,
        status: 'application_started',
        notes: 'Application submitted through secure website intake.',
      } as never)
      .select('id')
      .single();

    if (leadErr) throw leadErr;

    const { data: business, error: businessErr } = await supabase
      .from('businesses')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        legal_name: data.legal_name,
        dba: data.dba || null,
        entity_type: data.entity_type as never,
        ein_encrypted: encryptSensitiveField(data.ein),
        industry: data.industry,
        naics_code: data.naics_code || null,
        start_date: data.start_date,
        phone: data.business_phone,
        email: data.business_email,
        website: data.website || null,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        monthly_gross_revenue: data.monthly_gross_revenue,
        deposit_count_monthly: data.deposit_count || null,
        current_processor: data.current_processor || null,
        landlord_name: data.landlord_name || null,
        landlord_phone: data.landlord_phone || null,
        rent_amount: nullableNumber(data.rent_amount),
        has_tax_lien: data.has_tax_lien,
        has_bankruptcy: data.has_bankruptcy,
      } as never)
      .select('id')
      .single();

    if (businessErr) throw businessErr;

    const { data: owner, error: ownerErr } = await supabase
      .from('owners')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        dob_encrypted: encryptSensitiveField(data.dob),
        ssn_encrypted: encryptSensitiveField(data.ssn_full),
        ssn_last4: getLastFour(data.ssn_full),
        ownership_percentage: data.ownership_pct,
        credit_score_range: data.credit_range as never || null,
        address: data.home_address,
        city: data.home_city,
        state: data.home_state,
        zip: data.home_zip,
      } as never)
      .select('id')
      .single();

    if (ownerErr) throw ownerErr;

    const { error: businessOwnerErr } = await supabase.from('business_owners').insert({
      organization_id: DEFAULT_ORG_ID,
      business_id: business.id,
      owner_id: owner.id,
      ownership_percentage: data.ownership_pct,
      is_primary: true,
    } as never);

    if (businessOwnerErr) throw businessOwnerErr;

    const { data: application, error: applicationErr } = await supabase
      .from('applications')
      .insert({
        organization_id: DEFAULT_ORG_ID,
        business_id: business.id,
        lead_id: lead.id,
        status: 'submitted',
        requested_amount: data.requested_amount,
        use_of_funds: data.use_of_funds || null,
        desired_timeline: data.timeline || null,
        has_existing_advances: data.has_existing_advances,
        desired_payment_frequency: data.payment_frequency as never || null,
        notes: data.notes || null,
        bank_name: data.bank_name,
        account_type: data.account_type as never || null,
        routing_number: null,
        routing_number_encrypted: encryptSensitiveField(data.routing_number),
        account_last4: data.account_last4 || null,
        avg_monthly_deposits: nullableNumber(data.avg_monthly_deposits),
        negative_days_count: 0,
        nsf_count: 0,
        ending_balance_estimate: nullableNumber(data.ending_balance),
        submitted_at: new Date().toISOString(),
        ip_address: getClientIp(request),
        user_agent: request.headers.get('user-agent'),
      } as never)
      .select('id')
      .single();

    if (applicationErr) throw applicationErr;

    if (data.existing_advances.length > 0) {
      const { error: advancesErr } = await supabase.from('existing_advances').insert(
        data.existing_advances.map((advance) => ({
          organization_id: DEFAULT_ORG_ID,
          application_id: application.id,
          funder_name: advance.funder_name || null,
          original_funded_amount: nullableNumber(advance.original_amount),
          current_balance: nullableNumber(advance.current_balance),
          daily_payment: nullableNumber(advance.daily_payment),
          payment_frequency: advance.payment_frequency as never || null,
          notes: advance.notes || null,
        })) as never
      );
      if (advancesErr) throw advancesErr;
    }

    for (const [index, file] of Array.from(files.entries())) {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const storagePath = `${DEFAULT_ORG_ID}/${application.id}/${Date.now()}-${index}.${extension}`;
      const { error: uploadErr } = await supabase.storage
        .from('application-documents')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadErr) throw uploadErr;

      const { error: documentErr } = await supabase.from('documents').insert({
        organization_id: DEFAULT_ORG_ID,
        application_id: application.id,
        document_type: 'application_upload',
        label: file.name,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: storagePath,
        status: 'uploaded',
      } as never);
      if (documentErr) throw documentErr;
    }

    const { error: activityErr } = await supabase.from('activities').insert({
      organization_id: DEFAULT_ORG_ID,
      related_type: 'application',
      related_id: application.id,
      activity_type: 'application_submitted',
      title: 'Application submitted',
      description: `${data.first_name} ${data.last_name} submitted a secure funding application for ${data.legal_name}.`,
      metadata: { document_count: files.length, consent_authorized: data.consent_authorized },
    } as never);

    if (activityErr) throw activityErr;

    return NextResponse.json({ applicationId: application.id });
  } catch (error) {
    console.error('Application submission failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'We could not submit the application. Please try again or contact support.' }, { status: 500 });
  }
}
