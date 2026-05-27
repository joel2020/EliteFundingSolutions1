import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep'];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: lead } = await supabase
    .from('leads')
    .select('id,organization_id,business_name,first_name,last_name,email,phone,requested_amount,assigned_user_id,iso_broker_id,lead_source,status,notes')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!lead) return NextResponse.json({ success: false, error: 'Lead not found.' }, { status: 404 });
  if (lead.status === 'converted') return NextResponse.json({ success: false, error: 'Lead is already converted.' }, { status: 409 });

  const businessName = lead.business_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'New merchant';
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({
      organization_id: profile.organization_id,
      legal_name: businessName,
      email: lead.email || null,
      phone: lead.phone || null,
      notes: lead.notes || null,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('id')
    .single();

  if (businessError) return NextResponse.json({ success: false, error: businessError.message }, { status: 500 });

  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .insert({
      organization_id: profile.organization_id,
      business_id: business.id,
      lead_id: lead.id,
      title: businessName,
      requested_amount: Number(lead.requested_amount || 0) || null,
      stage_slug: 'lead_captured',
      assigned_user_id: lead.assigned_user_id || profile.id,
      iso_broker_id: lead.iso_broker_id || null,
      lead_source: lead.lead_source || 'manual_entry',
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('id')
    .single();

  if (dealError) return NextResponse.json({ success: false, error: dealError.message }, { status: 500 });

  await supabase.from('leads').update({ status: 'converted', updated_by: profile.id }).eq('id', lead.id).eq('organization_id', profile.organization_id);

  await Promise.allSettled([
    supabase.from('deal_status_history').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      from_stage: null,
      to_stage: 'lead_captured',
      changed_by: profile.id,
      notes: 'Lead converted to deal.',
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      business_id: business.id,
      lead_id: lead.id,
      activity_type: 'system',
      title: 'Lead converted to deal',
      body: businessName,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'lead_converted',
      resource_type: 'leads',
      resource_id: lead.id,
      new_data: { deal_id: deal.id, business_id: business.id },
    }),
  ]);

  return NextResponse.json({ success: true, dealId: deal.id, businessId: business.id });
}
