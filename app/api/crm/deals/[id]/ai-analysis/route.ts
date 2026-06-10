import { NextResponse } from 'next/server';
import { requireCrmProfile } from '@/lib/server-auth';
import { buildCrmAiContext, generateCrmAiAnalysis, summarizeAiForDeal } from '@/lib/crm-ai-engine';

export const dynamic = 'force-dynamic';

const AI_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

type RecordMap = Record<string, any>;

async function safeSingle(query: PromiseLike<any>) {
  const result = await query;
  return result?.data || null;
}

async function safeRows(query: PromiseLike<any>) {
  const result = await query;
  return result?.data || [];
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCrmProfile(AI_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;
  const payload = await request.json().catch(() => ({}));
  const question = String(payload?.question || '').trim();

  const deal = await safeSingle(
    supabase
      .from('deals')
      .select('*')
      .eq('id', params.id)
      .eq('organization_id', profile.organization_id)
      .maybeSingle()
  );

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const [
    business,
    application,
    documents,
    documentRequests,
    notes,
    riskEvents,
    submissions,
    offers,
    currentPositions,
    tasks,
    stipulations,
    partnerApplications,
    fundingPartners,
    ownerLinks,
  ] = await Promise.all([
    deal.business_id
      ? safeSingle(supabase.from('businesses').select('*').eq('id', deal.business_id).eq('organization_id', profile.organization_id).maybeSingle())
      : Promise.resolve(null),
    deal.application_id
      ? safeSingle(supabase.from('applications').select('*').eq('id', deal.application_id).eq('organization_id', profile.organization_id).maybeSingle())
      : Promise.resolve(null),
    safeRows(
      supabase
        .from('documents')
        .select('id,label,file_name,file_size,mime_type,document_type,status,application_variant,review_notes,ai_extraction,ai_extracted_at,created_at,updated_at')
        .eq('organization_id', profile.organization_id)
        .or(deal.application_id ? `deal_id.eq.${deal.id},application_id.eq.${deal.application_id}` : `deal_id.eq.${deal.id}`)
        .order('created_at', { ascending: false })
        .limit(50)
    ),
    safeRows(
      supabase
        .from('document_requests')
        .select('id,label,document_type,category,status,required,due_date,notes,description,updated_at')
        .eq('organization_id', profile.organization_id)
        .or(deal.application_id ? `deal_id.eq.${deal.id},application_id.eq.${deal.application_id}` : `deal_id.eq.${deal.id}`)
        .order('created_at', { ascending: false })
        .limit(50)
    ),
    safeRows(supabase.from('notes').select('id,title,body,note,content,created_at').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(15)),
    safeRows(supabase.from('deal_risk_events').select('*').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(15)),
    safeRows(supabase.from('partner_submissions').select('id,funding_partner_id,status,notes,decline_reason,conditions,created_at,updated_at').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(20)),
    safeRows(supabase.from('offers').select('*').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(15)),
    safeRows(supabase.from('current_positions').select('*').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).limit(10)),
    safeRows(supabase.from('tasks').select('id,title,status,priority,due_date,description,created_at').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('due_date', { ascending: true }).limit(20)),
    safeRows(supabase.from('stipulations').select('id,name,status,required_by_partner,due_date,notes,created_at').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(15)),
    safeRows(supabase.from('partner_applications').select('id,status,source_partner_name,original_file_name,created_at,notes,extracted_payload,edited_payload').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(10)),
    safeRows(supabase.from('funding_partners').select('*').eq('organization_id', profile.organization_id).is('deleted_at', null).order('name').limit(100)),
    deal.business_id
      ? safeRows(
        supabase
          .from('business_owners')
          .select('is_primary,ownership_percentage,owners(id,first_name,last_name,full_name,email,phone,address,city,state,zip,dob_encrypted,ssn_encrypted,ssn_last4,ownership_percentage,credit_score_range)')
          .eq('organization_id', profile.organization_id)
          .eq('business_id', deal.business_id)
          .order('is_primary', { ascending: false })
      )
      : Promise.resolve([]),
  ]);

  const owners = (ownerLinks || []).map((link: RecordMap) => ({
    ...(link.owners || {}),
    ownership_percentage: link.ownership_percentage || link.owners?.ownership_percentage,
  }));

  const context = buildCrmAiContext({
    deal,
    business,
    application,
    owners,
    documents,
    documentRequests,
    notes,
    riskEvents,
    submissions,
    offers,
    currentPositions,
    tasks,
    stipulations,
    partnerApplications,
    fundingPartners,
    question,
  });

  const generated = await generateCrmAiAnalysis(context);
  const bestMatchId = generated.analysis.funderMatches?.[0]?.fundingPartnerId || null;

  await Promise.allSettled([
    supabase
      .from('deals')
      .update({
        ai_summary: summarizeAiForDeal(generated.analysis),
        best_next_action: generated.analysis.recommendedNextActions?.[0] || generated.analysis.copilot?.answer || null,
        best_funding_partner_id: bestMatchId || null,
      })
      .eq('id', deal.id)
      .eq('organization_id', profile.organization_id),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      activity_type: 'system',
      title: 'AI CRM analysis generated',
      body: generated.analysis.packageBuilder?.status
        ? `Package ${generated.analysis.packageBuilder.status}; application QA ${generated.analysis.applicationQa?.status || 'reviewed'}.`
        : generated.analysis.summary,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: profile.user_id,
      action: 'crm_ai_analysis_generated',
      resource_type: 'deals',
      resource_id: deal.id,
      new_data: {
        provider: generated.provider,
        configured: generated.configured,
        question: question || null,
        package_status: generated.analysis.packageBuilder?.status,
        application_qa_status: generated.analysis.applicationQa?.status,
        best_funding_partner_id: bestMatchId,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    provider: generated.provider,
    configured: generated.configured,
    warning: generated.warning,
    analysis: generated.analysis,
  });
}
