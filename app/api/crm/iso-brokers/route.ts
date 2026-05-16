import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

const optionalText = z.preprocess(
  (value) => (value == null ? '' : value),
  z.string().trim().optional().default(''),
);

const optionalEmail = z.preprocess(
  (value) => (value == null ? '' : value),
  z.string().trim().email('Enter a valid email.').or(z.literal('')).default(''),
);

const brokerSchema = z.object({
  company_name: z.string().trim().min(1, 'Company name is required.'),
  broker_name: z.string().trim().min(1, 'Broker name is required.'),
  email: optionalEmail,
  phone: optionalText,
  commission_pct: z.coerce.number().min(0).max(100).default(5),
  payment_terms: optionalText,
  notes: optionalText,
});

function slugifyBroker(companyName: string, brokerName: string) {
  const base = [companyName, brokerName].filter(Boolean).join('-') || 'iso-broker';
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 72);
  return slug || 'iso-broker';
}

function isMissingApplicationSlugColumn(error: { code?: string; message?: string }) {
  const message = (error.message || '').toLowerCase();
  return error.code === 'PGRST204' || (message.includes('application_slug') && (message.includes('schema cache') || message.includes('column')));
}

export async function GET() {
  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const [brokerResult, commissionResult, dealResult] = await Promise.all([
    supabase.from('iso_brokers').select('*').eq('organization_id', profile.organization_id).order('created_at', { ascending: false }),
    supabase.from('commissions').select('id,iso_broker_id,deal_id,commission_amount,payment_status').eq('organization_id', profile.organization_id),
    supabase.from('deals').select('id,stage_slug,funded_at,funded_amount').eq('organization_id', profile.organization_id).is('deleted_at', null),
  ]);

  if (brokerResult.error) {
    return NextResponse.json({ success: false, error: brokerResult.error.message }, { status: 500, headers: noStoreHeaders });
  }

  return NextResponse.json({
    success: true,
    brokers: brokerResult.data || [],
    commissions: commissionResult.data || [],
    deals: dealResult.data || [],
  }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = brokerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid broker payload.', issues: parsed.error.flatten() }, { status: 400, headers: noStoreHeaders });
  }

  const form = parsed.data;
  const applicationSlug = `${slugifyBroker(form.company_name, form.broker_name)}-${Date.now().toString(36)}`;
  const payload = {
    organization_id: profile.organization_id,
    company_name: form.company_name,
    broker_name: form.broker_name,
    email: form.email || null,
    phone: form.phone || null,
    commission_pct: form.commission_pct,
    payment_terms: form.payment_terms || null,
    notes: form.notes || null,
    is_active: true,
    application_slug: applicationSlug,
  };

  let warning: string | null = null;
  let insertPayload: Record<string, unknown> = payload;
  let result = await supabase.from('iso_brokers').insert(insertPayload).select('*').single();

  if (result.error && isMissingApplicationSlugColumn(result.error)) {
    const { application_slug: _applicationSlug, ...fallbackPayload } = payload;
    insertPayload = fallbackPayload;
    result = await supabase.from('iso_brokers').insert(insertPayload).select('*').single();
    warning = 'Broker was added, but the application link column is not live in Supabase yet. Apply the ISO broker application links migration to enable broker links.';
  }

  if (result.error) {
    return NextResponse.json({ success: false, error: result.error.message }, { status: 500, headers: noStoreHeaders });
  }

  await Promise.allSettled([
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'iso_broker_created',
      resource_type: 'iso_brokers',
      resource_id: result.data.id,
      new_data: insertPayload,
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      activity_type: 'system',
      title: 'ISO broker created',
      body: `${form.company_name} was added as an ISO / broker partner.`,
      direction: 'internal',
      performed_by: profile.id,
      resource_type: 'iso_brokers',
      resource_id: result.data.id,
    }),
  ]);

  return NextResponse.json({ success: true, broker: result.data, warning }, { headers: noStoreHeaders });
}
