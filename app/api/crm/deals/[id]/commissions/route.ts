import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['super_admin', 'admin', 'manager'];

const commissionSchema = z.object({
  recipient_user_profile_id: z.string().uuid().optional().nullable(),
  recipient_name: z.string().trim().min(1),
  recipient_type: z.enum(['referral_partner', 'junior_closer', 'senior_closer', 'broker', 'sales_rep', 'processor', 'other']),
  percentage: z.coerce.number().min(0).max(100).optional().default(0),
  flat_amount: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().optional().default(''),
  payout_status: z.enum(['pending', 'approved', 'paid', 'held', 'clawed_back', 'cancelled']).optional().default('pending'),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data, error } = await supabase
    .from('commission_recipients')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('deal_id', params.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, commissions: data || [] });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(MANAGE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = commissionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid commission recipient.', issues: parsed.error.flatten() }, { status: 400 });

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const { data: commission, error } = await supabase
    .from('commission_recipients')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      recipient_user_profile_id: parsed.data.recipient_user_profile_id || null,
      recipient_name: parsed.data.recipient_name,
      recipient_type: parsed.data.recipient_type,
      percentage: parsed.data.percentage,
      flat_amount: parsed.data.flat_amount ?? null,
      notes: parsed.data.notes || null,
      payout_status: parsed.data.payout_status,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      activity_type: 'system',
      title: `Commission recipient added: ${parsed.data.recipient_name}`,
      body: `${parsed.data.recipient_type} - ${parsed.data.percentage}%${parsed.data.flat_amount ? ` + $${parsed.data.flat_amount}` : ''}`,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'commission_recipient_created',
      resource_type: 'commission_recipients',
      resource_id: commission.id,
      new_data: parsed.data,
    }),
  ]);

  return NextResponse.json({ success: true, commission });
}
