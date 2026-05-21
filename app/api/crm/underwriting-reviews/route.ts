import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const UNDERWRITING_ROLES = ['super_admin', 'admin', 'manager', 'processor', 'underwriter'];
const RISK_TIERS = ['A', 'B', 'C', 'D', 'decline'] as const;
const UNDERWRITING_DECISIONS = ['approved', 'approved_modified', 'declined', 'more_info_needed', 'pending'] as const;
const UNDERWRITING_STATUSES = ['pending', 'in_review', 'completed', 'on_hold'] as const;

const reviewSchema = z.object({
  deal_id: z.string().uuid(),
  application_id: z.string().uuid(),
  monthly_gross_revenue: z.number().nullable().optional(),
  nsf_count: z.number().int().default(0),
  negative_days: z.number().int().default(0),
  industry: z.string().nullable().optional(),
  time_in_business_months: z.number().int().nullable().optional(),
  document_completeness_pct: z.number().min(0).max(100),
  estimated_funding_max: z.number().nullable().optional(),
  risk_tier: z.enum(RISK_TIERS),
  underwriting_score: z.number().min(0).max(100),
  risk_flags: z.array(z.string()).default([]),
  notes: z.string().trim().optional().nullable(),
  decision: z.enum(UNDERWRITING_DECISIONS),
  decision_notes: z.string().trim().optional().nullable(),
  status: z.enum(UNDERWRITING_STATUSES).default('completed'),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(UNDERWRITING_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = reviewSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid underwriting payload.' }, { status: 400 });
  }

  const { data: application } = await supabase
    .from('applications')
    .select('id,organization_id')
    .eq('id', parsed.data.application_id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!application) {
    return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
  }

  await supabase
    .from('applications')
    .update({ underwriting_notes: parsed.data.notes || null, updated_by: profile.id })
    .eq('id', application.id)
    .eq('organization_id', profile.organization_id);

  const { data, error } = await supabase
    .from('underwriting_reviews')
    .insert({
      ...parsed.data,
      organization_id: profile.organization_id,
      decision_at: new Date().toISOString(),
      decision_by: profile.id,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: parsed.data.deal_id,
      application_id: parsed.data.application_id,
      activity_type: 'underwriting',
      title: 'Underwriting review completed',
      body: parsed.data.decision,
      direction: 'internal',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'underwriting_review_completed',
      resource_type: 'underwriting_reviews',
      resource_id: data.id,
      new_data: { decision: parsed.data.decision, risk_tier: parsed.data.risk_tier },
    }),
  ]);

  return NextResponse.json({ success: true, data });
}
