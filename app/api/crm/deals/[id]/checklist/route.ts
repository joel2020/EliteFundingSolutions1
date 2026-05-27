import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];
const WAIVE_ROLES = new Set(['super_admin', 'admin', 'manager', 'underwriter']);

const checklistSchema = z.object({
  request_id: z.string().uuid().optional().nullable(),
  application_id: z.string().uuid().optional().nullable(),
  document_type: z.string().trim().min(1),
  label: z.string().trim().min(1),
  required: z.boolean().default(true),
  status: z.string().trim().min(1),
  category: z.string().trim().min(1),
  notes: z.string().optional().nullable(),
  assigned_user_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = checklistSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid checklist payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.status === 'waived' && !WAIVE_ROLES.has(profile.role)) {
    return NextResponse.json({ success: false, error: 'Only managers, admins, and underwriters can waive checklist items.' }, { status: 403 });
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,assigned_user_id')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const payload = {
    organization_id: profile.organization_id,
    deal_id: deal.id,
    application_id: parsed.data.application_id || deal.application_id,
    document_type: parsed.data.document_type,
    label: parsed.data.label,
    required: parsed.data.required,
    status: parsed.data.status,
    category: parsed.data.category,
    notes: parsed.data.notes || null,
    assigned_user_id: parsed.data.assigned_user_id || deal.assigned_user_id || null,
    updated_by: profile.id,
  };

  const result = parsed.data.request_id
    ? await supabase.from('document_requests').update(payload).eq('id', parsed.data.request_id).eq('organization_id', profile.organization_id).select('id').single()
    : await supabase.from('document_requests').insert({ ...payload, created_by: profile.id }).select('id').single();

  if (result.error) return NextResponse.json({ success: false, error: result.error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'document_event',
      title: `Checklist item ${parsed.data.status}: ${parsed.data.label}`,
      body: parsed.data.notes || null,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: parsed.data.request_id ? 'document_request_updated' : 'document_request_created',
      resource_type: 'document_requests',
      resource_id: result.data.id,
      new_data: parsed.data,
    }),
  ]);

  return NextResponse.json({ success: true, requestId: result.data.id });
}
