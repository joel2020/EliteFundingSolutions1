import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const DEAL_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

const dealSchema = z.object({
  requested_amount: z.coerce.number().nonnegative().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(DEAL_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = dealSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid deal payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('deals')
    .select('id,organization_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();
  if (!existing) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const update: Record<string, any> = {};
  if (parsed.data.requested_amount !== undefined) update.requested_amount = parsed.data.requested_amount;
  if (Object.keys(update).length === 0) return NextResponse.json({ success: true });

  const { error } = await supabase
    .from('deals')
    .update(update)
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'deal_updated',
    resource_type: 'deals',
    resource_id: existing.id,
    new_data: update,
  }).then(() => null, () => null);

  return NextResponse.json({ success: true });
}
