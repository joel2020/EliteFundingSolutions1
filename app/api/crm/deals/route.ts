import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep'];

const dealSchema = z.object({
  title: z.string().optional().default(''),
  business_name: z.string().optional().default(''),
  contact_name: z.string().optional().default(''),
  contact_email: z.string().email().optional().or(z.literal('')).default(''),
  contact_phone: z.string().optional().default(''),
  requested_amount: z.coerce.number().positive().optional().nullable(),
  approved_amount: z.coerce.number().nonnegative().optional().nullable(),
  funded_amount: z.coerce.number().nonnegative().optional().nullable(),
  stage_slug: z.string().optional().default('documents_requested'),
  stage: z.string().optional(),
  assigned_user_id: z.string().uuid().optional().nullable(),
  junior_closer_id: z.string().uuid().optional().nullable(),
  senior_closer_id: z.string().uuid().optional().nullable(),
  lead_source: z.enum(['website', 'referral', 'broker', 'iso', 'paid_ads', 'organic_search', 'cold_email', 'partner', 'manual_entry']).optional().default('manual_entry'),
  notes: z.string().optional().nullable(),
});

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function normalizePhone(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeName(value?: string | null) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function findDuplicateBusiness(supabase: any, organizationId: string, form: z.infer<typeof dealSchema>, businessName: string) {
  const candidates: any[] = [];
  const email = String(form.contact_email || '').trim().toLowerCase();
  const phone = normalizePhone(form.contact_phone);

  if (email) {
    const { data } = await supabase
      .from('businesses')
      .select('id,legal_name,email,phone')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .ilike('email', email)
      .limit(5);
    if (data?.length) candidates.push(...data);
  }

  if (phone) {
    const { data } = await supabase
      .from('businesses')
      .select('id,legal_name,email,phone')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .limit(100);
    if (data?.length) candidates.push(...data.filter((row: any) => normalizePhone(row.phone) === phone));
  }

  const normalizedBusinessName = normalizeName(businessName);
  if (normalizedBusinessName.length >= 3) {
    const { data } = await supabase
      .from('businesses')
      .select('id,legal_name,email,phone')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .ilike('legal_name', businessName)
      .limit(5);
    if (data?.length) candidates.push(...data.filter((row: any) => normalizeName(row.legal_name) === normalizedBusinessName));
  }

  const unique = new Map(candidates.filter((row) => row?.id).map((row) => [row.id, row]));
  return Array.from(unique.values())[0] || null;
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = dealSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid deal payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const form = parsed.data;
  const businessName = (form.business_name || form.title || 'New merchant').trim();
  const stage = form.stage || form.stage_slug || 'documents_requested';
  const assignedUserId = form.assigned_user_id || profile.id;
  const requestedAmount = form.requested_amount ?? null;
  const { firstName, lastName } = splitName(form.contact_name);
  const duplicateBusiness = await findDuplicateBusiness(supabase, profile.organization_id, form, businessName);
  const duplicateBusinessId = duplicateBusiness?.id || null;
  let submissionSequence = 1;
  if (duplicateBusinessId) {
    const { count } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .or(`business_id.eq.${duplicateBusinessId},duplicate_of_business_id.eq.${duplicateBusinessId}`);
    submissionSequence = Number(count || 0) + 1;
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({
      organization_id: profile.organization_id,
      legal_name: businessName,
      email: form.contact_email || null,
      phone: form.contact_phone || null,
      notes: form.notes || null,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('id')
    .single();

  if (businessError) {
    return NextResponse.json({ success: false, error: businessError.message }, { status: 500 });
  }

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert({
      organization_id: profile.organization_id,
      lead_source: form.lead_source,
      first_name: firstName,
      last_name: lastName,
      email: form.contact_email || null,
      phone: form.contact_phone || null,
      business_name: businessName,
      status: 'converted',
      assigned_user_id: assignedUserId,
      notes: form.notes || null,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('id')
    .single();

  if (leadError) {
    return NextResponse.json({ success: false, error: leadError.message }, { status: 500 });
  }

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      organization_id: profile.organization_id,
      business_id: business.id,
      lead_id: lead.id,
      title: form.title || `${businessName} funding request`,
      requested_amount: requestedAmount,
      approved_amount: form.approved_amount ?? null,
      funded_amount: form.funded_amount ?? null,
      stage_slug: stage,
      assigned_user_id: assignedUserId,
      junior_closer_id: form.junior_closer_id || null,
      senior_closer_id: form.senior_closer_id || null,
      lead_source: form.lead_source,
      duplicate_of_business_id: duplicateBusinessId,
      submission_sequence: submissionSequence,
      notes: form.notes || null,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('id')
    .single();

  if (dealError) {
    return NextResponse.json({ success: false, error: dealError.message }, { status: 500 });
  }

  await Promise.allSettled([
    supabase.from('deal_status_history').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      from_stage: null,
      to_stage: stage,
      changed_by: profile.id,
      notes: 'Deal created from CRM.',
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      business_id: business.id,
      lead_id: lead.id,
      activity_type: 'system',
      title: 'Deal created',
      body: `${businessName} was added to the pipeline.`,
      direction: 'internal',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'deal_created',
      resource_type: 'deals',
      resource_id: deal.id,
      new_data: { business_id: business.id, lead_id: lead.id, stage_slug: stage, requested_amount: requestedAmount, duplicate_of_business_id: duplicateBusinessId, submission_sequence: submissionSequence },
    }),
  ]);

  return NextResponse.json({
    success: true,
    dealId: deal.id,
    businessId: business.id,
    leadId: lead.id,
    duplicateWarning: duplicateBusinessId ? `Possible repeat merchant matched to ${duplicateBusiness.legal_name || 'an existing business'}. Submission marked #${submissionSequence}.` : null,
  });
}
