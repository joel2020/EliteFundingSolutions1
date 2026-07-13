import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];
const TERMINAL_STAGES = new Set(['funded', 'declined', 'defaulted']);

// Duplicate a deal for double funding: a second deal on the same company (same business,
// application, and paperwork) so two lenders can be worked at the same time. Titles get
// letter suffixes — "Acme LLC" and "Acme LLC (B)".
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: source } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,lead_id,application_id,title,requested_amount,assigned_user_id,iso_broker_id,lead_source,stage_slug,junior_closer_id,senior_closer_id,referred_by_user_profile_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!source) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const { count: siblingCount } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('business_id', source.business_id)
    .is('deleted_at', null);

  const baseTitle = String(source.title || 'Deal').replace(/\s\([B-Z]\)$/, '');
  // First duplicate becomes "(B)", the next "(C)", and so on.
  const suffixLetter = String.fromCharCode(Math.min(65 + Number(siblingCount || 1), 90));
  const title = `${baseTitle} (${suffixLetter})`;

  const { data: created, error } = await supabase
    .from('deals')
    .insert({
      organization_id: profile.organization_id,
      business_id: source.business_id,
      lead_id: source.lead_id,
      application_id: source.application_id,
      title,
      requested_amount: source.requested_amount,
      assigned_user_id: source.assigned_user_id,
      iso_broker_id: source.iso_broker_id,
      junior_closer_id: source.junior_closer_id,
      senior_closer_id: source.senior_closer_id,
      referred_by_user_profile_id: source.referred_by_user_profile_id,
      lead_source: source.lead_source || 'manual_entry',
      stage_slug: TERMINAL_STAGES.has(String(source.stage_slug)) ? 'application_submitted' : (source.stage_slug || 'application_submitted'),
      submission_sequence: Number(siblingCount || 0) + 1,
      notes: `Duplicated from deal ${source.id} for double funding.`,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('id')
    .single();
  if (error || !created) return NextResponse.json({ success: false, error: error?.message || 'Could not duplicate deal.' }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: created.id,
      business_id: source.business_id,
      lead_id: source.lead_id,
      application_id: source.application_id,
      activity_type: 'system',
      title: 'Deal duplicated for double funding',
      body: `Duplicated from ${source.title || source.id}`,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'deal_duplicated',
      resource_type: 'deals',
      resource_id: created.id,
      new_data: { source_deal_id: source.id, title },
    }),
  ]);

  return NextResponse.json({ success: true, dealId: created.id, title });
}
