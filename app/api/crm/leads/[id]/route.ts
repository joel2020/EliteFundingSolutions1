import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep'];
const updateLeadSchema = z.object({
  business_name: z.string().trim().optional().nullable(),
  first_name: z.string().trim().optional().nullable(),
  last_name: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  lead_source: z.string().trim().optional(),
  status: z.string().trim().optional(),
  notes: z.string().optional().nullable(),
  requested_amount: z.coerce.number().nonnegative().optional().nullable(),
  assigned_user_id: z.string().uuid().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = updateLeadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid lead payload.', issues: parsed.error.flatten() }, { status: 400 });

  const { data: existing } = await supabase
    .from('leads')
    .select('id,organization_id,status,assigned_user_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!existing) return NextResponse.json({ success: false, error: 'Lead not found.' }, { status: 404 });

  const { error } = await supabase
    .from('leads')
    .update({ ...parsed.data, updated_by: profile.id })
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'lead_updated',
    resource_type: 'leads',
    resource_id: existing.id,
    old_data: existing,
    new_data: parsed.data,
  });

  return NextResponse.json({ success: true });
}
