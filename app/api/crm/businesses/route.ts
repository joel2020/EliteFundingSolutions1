import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const BUSINESS_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

const businessSchema = z.object({
  legal_name: z.string().trim().min(1),
  dba: z.string().trim().optional().nullable(),
  entity_type: z.string().trim().optional().nullable(),
  industry: z.string().trim().optional().nullable(),
  start_date: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  website: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  zip: z.string().trim().optional().nullable(),
  monthly_gross_revenue: z.number().nullable().optional(),
  average_daily_balance: z.number().nullable().optional(),
  deposit_count_monthly: z.number().int().nullable().optional(),
  notes: z.string().trim().optional().nullable(),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(BUSINESS_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = businessSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid business payload.' }, { status: 400 });
  }

  const payload = {
    ...parsed.data,
    email: parsed.data.email || null,
    organization_id: profile.organization_id,
    created_by: profile.id,
    updated_by: profile.id,
  };

  const { data, error } = await supabase
    .from('businesses')
    .insert(payload)
    .select('*')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      business_id: data.id,
      activity_type: 'business',
      title: 'Business created',
      body: data.legal_name,
      direction: 'internal',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'business_created',
      resource_type: 'businesses',
      resource_id: data.id,
      new_data: { legal_name: data.legal_name },
    }),
  ]);

  return NextResponse.json({ success: true, data });
}
