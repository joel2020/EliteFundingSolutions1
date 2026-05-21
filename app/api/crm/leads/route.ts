import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LEAD_SOURCES, LEAD_STATUSES, normalizeLeadSource, normalizeLeadStatus } from '@/lib/crm-leads';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep'];
const leadSchema = z.object({
  business_name: z.string().trim().optional().nullable(),
  first_name: z.string().trim().optional().nullable(),
  last_name: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  lead_source: z.preprocess(normalizeLeadSource, z.enum(LEAD_SOURCES)).optional().default('manual_entry'),
  status: z.preprocess(normalizeLeadStatus, z.enum(LEAD_STATUSES)).optional().default('new'),
  notes: z.string().optional().nullable(),
  requested_amount: z.coerce.number().nonnegative().optional().nullable(),
  assigned_user_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const body = await request.json().catch(() => ({}));
  const rows = Array.isArray(body) ? body : [body];
  const parsed = z.array(leadSchema).min(1).max(250).safeParse(rows);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid lead payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const insertRows = parsed.data.map((row) => ({
    organization_id: profile.organization_id,
    business_name: row.business_name || null,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    phone: row.phone || null,
    email: row.email || null,
    lead_source: row.lead_source || 'manual_entry',
    status: row.status || 'new',
    notes: row.notes || null,
    requested_amount: row.requested_amount ?? null,
    assigned_user_id: row.assigned_user_id || profile.id,
    created_by: profile.id,
    updated_by: profile.id,
  }));

  const { data: leads, error } = await supabase.from('leads').insert(insertRows).select('id,business_name,email');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: rows.length > 1 ? 'leads_imported' : 'lead_created',
    resource_type: 'leads',
    resource_id: leads?.[0]?.id || null,
    new_data: { count: insertRows.length, lead_ids: (leads || []).map((lead) => lead.id) },
  });

  return NextResponse.json({ success: true, leads: leads || [] });
}
