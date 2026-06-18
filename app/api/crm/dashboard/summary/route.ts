import { NextResponse } from 'next/server';
import { requireCrmProfile } from '@/lib/server-auth';
import { INTERNAL_CRM_ROLES } from '@/lib/access-control';
import { getManagerCockpit } from '@/lib/crm-intelligence';

type RecordMap = Record<string, any>;

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const STAGE_OPTIONS = [
  ['documents_requested', 'Docs needed'],
  ['application_submitted', 'Submitted'],
  ['approved', 'Approved'],
  ['declined', 'Declined'],
  ['contract_requested', 'Contracts requested'],
  ['contract_signed', 'Contracts signed'],
  ['funded', 'Funded'],
  ['defaulted', 'Defaulted'],
  ['renewal_eligible', 'Renewal eligible'],
];

function userDisplayName(user: RecordMap) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unassigned';
}

function businessName(deal: RecordMap) {
  return deal.businesses?.dba || deal.businesses?.legal_name || deal.title || deal.business_name || 'Unnamed business';
}

function publicDeal(deal: RecordMap) {
  return {
    id: deal.id,
    title: deal.title,
    business_id: deal.business_id,
    application_id: deal.application_id,
    assigned_user_id: deal.assigned_user_id,
    requested_amount: deal.requested_amount,
    funded_amount: deal.funded_amount,
    stage_slug: deal.stage_slug,
    stage_changed_at: deal.stage_changed_at,
    funded_at: deal.funded_at,
    updated_at: deal.updated_at,
    created_at: deal.created_at,
    businesses: deal.businesses,
    user_profiles: deal.user_profiles,
    display_name: businessName(deal),
  };
}

function publicSignal(row: RecordMap) {
  return {
    deal: publicDeal(row.deal),
    healthScore: row.healthScore,
    status: row.status,
    stageAgeDays: row.stageAgeDays,
    slaDays: row.slaDays,
    nextAction: row.nextAction,
  };
}

export async function GET() {
  const auth = await requireCrmProfile(INTERNAL_CRM_ROLES);
  if ('response' in auth) return auth.response;

  const { profile, supabase } = auth;
  const org = profile.organization_id || ORG_ID;

  const [
    leadsResult,
    dealsResult,
    offersResult,
    renewalsResult,
    commissionsResult,
    partnersResult,
    usersResult,
    activitiesResult,
    documentsResult,
    tasksResult,
    positionsResult,
    businessesResult,
  ] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', org).is('deleted_at', null),
    supabase.from('deals').select('id,title,business_id,application_id,assigned_user_id,requested_amount,funded_amount,stage_slug,funded_at,updated_at,created_at').eq('organization_id', org).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('offers').select('id,deal_id,funding_partner_id,approved_amount,status,created_at').eq('organization_id', org).order('created_at', { ascending: false }),
    supabase.from('renewals').select('id,original_deal_id,assigned_user_id,updated_at').eq('organization_id', org).order('updated_at', { ascending: false }),
    supabase.from('commissions').select('id,deal_id,offer_id,rep_id,commission_amount,payment_status,created_at').eq('organization_id', org).order('created_at', { ascending: false }),
    supabase.from('funding_partners').select('id,name').eq('organization_id', org).is('deleted_at', null).order('name'),
    supabase.from('user_profiles').select('id,email,first_name,last_name,role').eq('organization_id', org).is('deleted_at', null).order('first_name'),
    supabase.from('activities').select('id,title,action,created_at,updated_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(6),
    supabase.from('documents').select('id,deal_id,application_id,document_type,status').eq('organization_id', org).is('deleted_at', null).order('created_at', { ascending: false }).limit(250),
    supabase.from('tasks').select('id,deal_id,application_id,title,status,due_date,assigned_user_id').eq('organization_id', org).order('due_date', { ascending: true }).limit(250),
    supabase.from('current_positions').select('id,deal_id,business_id,status,current_balance,original_funded_amount').eq('organization_id', org).order('created_at', { ascending: false }).limit(250),
    supabase.from('businesses').select('id,legal_name,dba,state,industry,monthly_gross_revenue,start_date').eq('organization_id', org).is('deleted_at', null).limit(500),
  ]);

  const hardError = [dealsResult, offersResult, partnersResult, usersResult].find((result) => result.error);
  if (hardError?.error) {
    return NextResponse.json({ success: false, error: hardError.error.message }, { status: 500 });
  }

  const rawDeals = dealsResult.data || [];
  const offers = offersResult.data || [];
  const renewals = renewalsResult.data || [];
  const commissions = commissionsResult.data || [];
  const partners = partnersResult.data || [];
  const users = usersResult.data || [];
  const documents = documentsResult.data || [];
  const tasks = tasksResult.data || [];
  const positions = positionsResult.data || [];
  const businesses = businessesResult.data || [];
  const activities = activitiesResult.data || [];

  const businessesById = Object.fromEntries(businesses.map((business: RecordMap) => [business.id, business]));
  const usersById = Object.fromEntries(users.map((user: RecordMap) => [user.id, user]));
  const deals = rawDeals.map((deal: RecordMap) => ({
    ...deal,
    businesses: businessesById[deal.business_id],
    user_profiles: usersById[deal.assigned_user_id],
  }));

  const fundedDeals = deals.filter((deal: RecordMap) => deal.stage_slug === 'funded' || deal.funded_at);
  const activeDeals = deals.filter((deal: RecordMap) => !['funded', 'declined', 'lost_unresponsive'].includes(deal.stage_slug));
  const totalFunded = fundedDeals.reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0);
  const pendingOffers = offers.filter((offer: RecordMap) => ['received', 'presented'].includes(offer.status)).length;
  const approvalRate = deals.length ? Math.round((deals.filter((deal: RecordMap) => ['offers_received', 'offer_presented', 'contract_sent', 'contract_signed', 'funded'].includes(deal.stage_slug)).length / deals.length) * 100) : 0;
  const estimatedEarnings = commissions.reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0);
  const paidEarnings = commissions.filter((row: RecordMap) => row.payment_status === 'paid').reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0);
  const attention = deals.filter((deal: RecordMap) => ['documents_requested', 'underwriting_review', 'contract_sent'].includes(deal.stage_slug)).slice(0, 6).map(publicDeal);
  const cockpit = getManagerCockpit({ deals, documents, offers, tasks, positions, users });
  const partnerData = partners.slice(0, 5).map((partner: RecordMap) => ({
    name: partner.name,
    value: offers.filter((offer: RecordMap) => offer.funding_partner_id === partner.id).length || 1,
  }));

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    metrics: {
      totalLeads: leadsResult.count || 0,
      activeDeals: activeDeals.length,
      fundedDeals: fundedDeals.length,
      totalFunded,
      pendingOffers,
      approvalRate,
      renewalOpportunities: renewals.length,
      estimatedEarnings,
      paidEarnings,
      needsAttention: attention.length,
    },
    stageData: STAGE_OPTIONS.map(([slug, name]) => ({ name, value: deals.filter((deal: RecordMap) => deal.stage_slug === slug).length })),
    partnerData,
    repData: users.filter((user: RecordMap) => user.role !== 'client').slice(0, 6).map((user: RecordMap) => {
      const repDeals = deals.filter((deal: RecordMap) => deal.assigned_user_id === user.id);
      const repFunded = repDeals.filter((deal: RecordMap) => deal.stage_slug === 'funded' || deal.funded_at);
      return {
        name: userDisplayName(user),
        deals: repDeals.length,
        funded: repFunded.reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0),
      };
    }),
    attention,
    activities: activities.map((activity: RecordMap) => ({
      id: activity.id,
      title: activity.title || activity.action || 'Activity',
      created_at: activity.created_at,
      updated_at: activity.updated_at,
    })),
    cockpit: {
      averageHealth: cockpit.averageHealth,
      stalledDeals: cockpit.stalledDeals.slice(0, 8).map(publicSignal),
      blockedDeals: cockpit.blockedDeals.slice(0, 8).map(publicSignal),
      readyToSubmit: cockpit.readyToSubmit.slice(0, 8).map(publicSignal),
      offerPending: cockpit.offerPending.slice(0, 8).map(publicSignal),
      repRows: cockpit.repRows.slice(0, 6).map((row: RecordMap) => ({
        user: { id: row.user.id, email: row.user.email, first_name: row.user.first_name, last_name: row.user.last_name, role: row.user.role },
        ownedDealCount: row.ownedDeals.length,
        fundedVolume: row.fundedVolume,
      })),
    },
  });
}
