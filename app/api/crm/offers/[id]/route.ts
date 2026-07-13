import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Matches who can add an offer (deal write roles that touch funder terms).
const DELETE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'underwriter'];
// Statuses allowed by the offers_status_check DB constraint.
const OFFER_STATUSES = ['received', 'presented', 'accepted', 'rejected', 'expired', 'withdrawn'] as const;
const PAYMENT_FREQUENCIES = ['daily', 'weekly', 'bi_weekly'] as const;

const updateSchema = z.object({
  funding_partner_id: z.string().uuid().optional().nullable(),
  approved_amount: z.coerce.number().positive().optional(),
  factor_rate: z.coerce.number().positive().optional(),
  payback_amount: z.coerce.number().positive().optional(),
  term_days: z.coerce.number().int().positive().optional(),
  payment_frequency: z.enum(PAYMENT_FREQUENCIES).optional(),
  daily_payment: z.coerce.number().nonnegative().optional().nullable(),
  weekly_payment: z.coerce.number().nonnegative().optional().nullable(),
  holdback_pct: z.coerce.number().nonnegative().optional().nullable(),
  buy_rate: z.coerce.number().nonnegative().optional().nullable(),
  sell_rate: z.coerce.number().nonnegative().optional().nullable(),
  net_funding_amount: z.coerce.number().nonnegative().optional().nullable(),
  origination_fee: z.coerce.number().nonnegative().optional().nullable(),
  expires_at: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(OFFER_STATUSES).optional(),
});

// Edit an offer's terms (amount, factor, term, ...) or its status — including marking it
// declined ('rejected') or withdrawn when a funder pulls the offer back.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(DELETE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid offer payload.', issues: parsed.error.flatten() }, { status: 400 });

  const { data: existing } = await supabase
    .from('offers')
    .select('id,organization_id,deal_id,status,approved_amount')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return NextResponse.json({ success: false, error: 'Offer not found.' }, { status: 404 });

  const update: Record<string, any> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) update[key] = key === 'expires_at' || key === 'notes' ? (value || null) : value;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ success: true });
  if (update.status === 'accepted') update.accepted_at = new Date().toISOString();

  const { error } = await supabase
    .from('offers')
    .update(update)
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'offer_updated',
    resource_type: 'offers',
    resource_id: existing.id,
    old_data: { status: existing.status, approved_amount: existing.approved_amount },
    new_data: update,
  }).then(() => null, () => null);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(DELETE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: existing } = await supabase
    .from('offers')
    .select('id,organization_id,deal_id,funding_partner_id,approved_amount,status')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return NextResponse.json({ success: false, error: 'Offer not found.' }, { status: 404 });

  // Soft delete: hides the offer from the CRM but keeps the row so any commission,
  // contract, or stipulation record already linked to it stays intact.
  const { error } = await supabase
    .from('offers')
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id })
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'offer_deleted',
    resource_type: 'offers',
    resource_id: existing.id,
    old_data: { deal_id: existing.deal_id, funding_partner_id: existing.funding_partner_id, approved_amount: existing.approved_amount, status: existing.status },
  }).then(() => null, () => null);

  return NextResponse.json({ success: true });
}
