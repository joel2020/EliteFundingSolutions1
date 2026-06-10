import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];
const csv = (value?: string) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

const partnerSchema = z.object({
  name: z.string().trim().optional().default(''),
  company_name: z.string().trim().optional().default(''),
  contact_name: z.string().trim().optional().default(''),
  email: z.string().trim().email('Enter a valid contact email.').optional().or(z.literal('')).default(''),
  phone: z.string().trim().optional().default(''),
  submission_email: z.string().trim().email('Enter a valid submission email.').optional().or(z.literal('')).default(''),
  portal_url: z.string().trim().url('Enter a valid portal URL.').optional().or(z.literal('')).default(''),
  preferred_submission_method: z.enum(['email', 'portal', 'api', 'manual']).optional().nullable(),
  product_types: z.string().trim().optional().default(''),
  preferred_industries: z.string().trim().optional().default(''),
  required_documents: z.string().trim().optional().default(''),
  min_funding_amount: z.coerce.number().nonnegative().optional().nullable(),
  max_funding_amount: z.coerce.number().nonnegative().optional().nullable(),
  min_monthly_revenue: z.coerce.number().nonnegative().optional().nullable(),
  min_time_in_business_months: z.coerce.number().int().nonnegative().optional().nullable(),
  min_credit_score: z.coerce.number().int().min(300).max(850).optional().nullable(),
  max_existing_positions: z.coerce.number().int().nonnegative().optional().nullable(),
  max_negative_days: z.coerce.number().int().nonnegative().optional().nullable(),
  max_nsf_count: z.coerce.number().int().nonnegative().optional().nullable(),
  states_served: z.string().trim().optional().default(''),
  restricted_industries: z.string().trim().optional().default(''),
  avg_approval_days: z.coerce.number().int().nonnegative().optional().nullable(),
  criteria_notes: z.string().trim().optional().default(''),
  notes: z.string().trim().optional().default(''),
  is_active: z.boolean().optional().default(true),
}).transform((value) => ({ ...value, name: value.name || value.company_name }));

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const { id } = params;
  if (!id) return NextResponse.json({ success: false, error: 'Funder ID required' }, { status: 400 });

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = partnerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid funding partner payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const form = parsed.data;
  if (!form.name) return NextResponse.json({ success: false, error: 'Company name is required.' }, { status: 400 });
  if (form.max_funding_amount != null && form.min_funding_amount != null && form.max_funding_amount < form.min_funding_amount) {
    return NextResponse.json({ success: false, error: 'Max funding must be greater than min funding.' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('funding_partners')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!existing) return NextResponse.json({ success: false, error: 'Funder not found.' }, { status: 404 });

  const updatePayload = {
    name: form.name,
    contact_name: form.contact_name || null,
    email: form.email || null,
    phone: form.phone || null,
    submission_email: form.submission_email || null,
    portal_url: form.portal_url || null,
    preferred_submission_method: form.preferred_submission_method || null,
    product_types: csv(form.product_types),
    preferred_industries: csv(form.preferred_industries),
    required_documents: csv(form.required_documents),
    min_funding_amount: form.min_funding_amount ?? null,
    max_funding_amount: form.max_funding_amount ?? null,
    min_monthly_revenue: form.min_monthly_revenue ?? null,
    min_time_in_business_months: form.min_time_in_business_months ?? null,
    min_credit_score: form.min_credit_score ?? null,
    max_existing_positions: form.max_existing_positions ?? null,
    max_negative_days: form.max_negative_days ?? null,
    max_nsf_count: form.max_nsf_count ?? null,
    states_served: csv(form.states_served.toUpperCase()),
    restricted_industries: csv(form.restricted_industries),
    avg_approval_days: form.avg_approval_days ?? null,
    criteria_notes: form.criteria_notes || null,
    notes: form.notes || null,
    is_active: form.is_active,
    updated_at: new Date().toISOString(),
  };

  const { data: partner, error } = await supabase
    .from('funding_partners')
    .update(updatePayload)
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'funding_partner_updated',
      resource_type: 'funding_partners',
      resource_id: id,
      old_data: existing,
      new_data: updatePayload,
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      activity_type: 'system',
      title: 'Funding partner updated',
      body: `${form.name} rules/profile were updated.`,
      direction: 'internal',
      performed_by: profile.id,
      resource_type: 'funding_partners',
      resource_id: id,
    }),
  ]);

  return NextResponse.json({ success: true, partner });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Funder ID required' }, { status: 400 });

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: existing } = await supabase
    .from('funding_partners')
    .select('id,organization_id,name,is_active,deleted_at')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!existing) return NextResponse.json({ error: 'Funder not found' }, { status: 404 });

  const { error } = await supabase
    .from('funding_partners')
    .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: profile.id })
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'funding_partner_archived',
    resource_type: 'funding_partners',
    resource_id: id,
    old_data: existing,
    new_data: { is_active: false, deleted_at: true },
  });

  return NextResponse.json({ success: true, message: 'Funder archived successfully' });
}
