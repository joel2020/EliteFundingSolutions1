import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'processor', 'underwriter'];

const updateSchema = z.object({
  edited_payload: z.record(z.any()).optional(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(['uploaded','extraction_needed','draft_ready','converted','saved_to_deal','failed']).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid partner application update.', issues: parsed.error.flatten() }, { status: 400 });

  const { data: existing } = await supabase
    .from('partner_application_uploads')
    .select('id,organization_id,deal_id,application_id,edited_payload,notes,status')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!existing) return NextResponse.json({ success: false, error: 'Partner application not found.' }, { status: 404 });

  const updates = {
    ...(parsed.data.edited_payload ? { edited_payload: parsed.data.edited_payload } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    updated_by: profile.id,
  };

  const { data: partnerApplication, error } = await supabase
    .from('partner_application_uploads')
    .update(updates)
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'partner_application_updated',
    resource_type: 'partner_application_uploads',
    resource_id: existing.id,
    old_data: { status: existing.status, notes: existing.notes, edited_payload_keys: Object.keys(existing.edited_payload || {}) },
    new_data: { status: partnerApplication.status, notes: partnerApplication.notes, edited_payload_keys: Object.keys(partnerApplication.edited_payload || {}) },
  });

  return NextResponse.json({ success: true, partnerApplication });
}
