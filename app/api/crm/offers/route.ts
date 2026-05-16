import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'underwriter'];
const offerSchema = z.object({
  deal_id: z.string().uuid(),
  approved_amount: z.coerce.number().positive(),
  factor_rate: z.coerce.number().positive(),
  payback_amount: z.coerce.number().positive(),
  term_days: z.coerce.number().int().positive(),
  payment_frequency: z.string().trim().min(1),
  daily_payment: z.coerce.number().nonnegative().optional().nullable(),
  weekly_payment: z.coerce.number().nonnegative().optional().nullable(),
  holdback_pct: z.coerce.number().nonnegative().optional().nullable(),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = offerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid offer payload.', issues: parsed.error.flatten() }, { status: 400 });

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id')
    .eq('id', parsed.data.deal_id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const { data: offer, error } = await supabase
    .from('offers')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      approved_amount: parsed.data.approved_amount,
      factor_rate: parsed.data.factor_rate,
      payback_amount: parsed.data.payback_amount,
      term_days: parsed.data.term_days,
      payment_frequency: parsed.data.payment_frequency,
      daily_payment: parsed.data.daily_payment ?? null,
      weekly_payment: parsed.data.weekly_payment ?? null,
      holdback_pct: parsed.data.holdback_pct ?? null,
      status: 'received',
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      activity_type: 'offer',
      title: 'Offer received',
      body: `Approved amount $${parsed.data.approved_amount.toLocaleString()}`,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'offer_created',
      resource_type: 'offers',
      resource_id: offer.id,
      new_data: parsed.data,
    }),
  ]);

  return NextResponse.json({ success: true, offerId: offer.id });
}
