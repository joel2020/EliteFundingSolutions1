type RecordMap = Record<string, any>;

export const REQUIRED_MCA_DOCUMENTS = [
  { type: 'bank_statements', label: 'Last 3 bank statements', requiredBy: 'submission' },
  { type: 'drivers_license', label: 'Owner ID', requiredBy: 'underwriting' },
  { type: 'voided_check', label: 'Voided check or bank letter', requiredBy: 'contract' },
  { type: 'signed_application', label: 'Signed application', requiredBy: 'contract' },
  { type: 'signed_contract', label: 'Signed funding agreement', requiredBy: 'funding' },
] as const;

const DISCLOSURE_STATES = new Set(['CA', 'CT', 'FL', 'GA', 'KS', 'MO', 'NY', 'TX', 'UT', 'VA']);
const HIGH_RISK_INDUSTRIES = ['adult', 'cannabis', 'crypto', 'gambling', 'payday', 'weapons'];

function numberValue(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function normalize(value: any) {
  return String(value || '').trim().toLowerCase();
}

function hasDocument(documents: RecordMap[], type: string) {
  return documents.some((doc) => {
    const docType = normalize(doc.document_type).replace('bank_statement', 'bank_statements');
    return docType === type && doc.status !== 'rejected';
  });
}

function monthsSince(value?: string | null) {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
}

export function getMissingDocuments(deal: RecordMap, documents: RecordMap[]) {
  const stage = normalize(deal.stage_slug);
  const required = REQUIRED_MCA_DOCUMENTS.filter((doc) => {
    if (doc.requiredBy === 'submission') return true;
    if (doc.requiredBy === 'underwriting') return ['underwriting_review', 'offers_received', 'offer_presented', 'contract_sent', 'contract_signed', 'funded', 'renewal_eligible'].includes(stage);
    if (doc.requiredBy === 'contract') return ['contract_sent', 'contract_signed', 'funded', 'renewal_eligible'].includes(stage);
    return ['funded', 'renewal_eligible'].includes(stage);
  });
  return required.filter((doc) => !hasDocument(documents, doc.type));
}

export function getDisclosureState(business?: RecordMap | null) {
  const state = String(business?.state || '').trim().toUpperCase();
  return DISCLOSURE_STATES.has(state) ? state : null;
}

export function getComplianceBlocks(deal: RecordMap, documents: RecordMap[]) {
  const missing = getMissingDocuments(deal, documents);
  const disclosureState = getDisclosureState(deal.businesses);
  const blocks: string[] = [];
  if (missing.some((doc) => doc.requiredBy === 'funding')) blocks.push('Signed funding agreement is missing.');
  if (missing.some((doc) => doc.requiredBy === 'contract')) blocks.push('Contract-stage documents are incomplete.');
  if (disclosureState && !deal.disclosure_signed_at) blocks.push(`${disclosureState} commercial financing disclosure needs signature evidence.`);
  if (normalize(deal.stage_slug) === 'funded' && !deal.funded_at) blocks.push('Funded date is missing.');
  return blocks;
}

export function getDealScore(deal: RecordMap, documents: RecordMap[], positions: RecordMap[] = []) {
  const business = deal.businesses || {};
  const monthlyRevenue = numberValue(business.monthly_gross_revenue || deal.avg_monthly_deposits);
  const requested = numberValue(deal.requested_amount);
  const timeInBusiness = monthsSince(business.start_date) ?? numberValue(deal.time_in_business_months);
  const activePositions = positions.filter((row) => normalize(row.status || 'active') === 'active');
  const negativeDays = numberValue(deal.negative_days_count || deal.negative_days);
  const nsfCount = numberValue(deal.nsf_count);
  const missingDocs = getMissingDocuments(deal, documents);
  const industry = normalize(business.industry);

  let score = 52;
  const flags: string[] = [];

  if (monthlyRevenue >= 100000) score += 18;
  else if (monthlyRevenue >= 50000) score += 12;
  else if (monthlyRevenue >= 20000) score += 6;
  else if (monthlyRevenue > 0) {
    score -= 8;
    flags.push('Low monthly revenue');
  }

  if (requested && monthlyRevenue) {
    const requestRatio = requested / monthlyRevenue;
    if (requestRatio <= 0.6) score += 12;
    else if (requestRatio <= 1) score += 6;
    else {
      score -= 10;
      flags.push('Requested amount is high versus revenue');
    }
  }

  if (timeInBusiness >= 24) score += 10;
  else if (timeInBusiness >= 12) score += 6;
  else if (timeInBusiness > 0) {
    score -= 8;
    flags.push('Short time in business');
  }

  if (activePositions.length >= 3) {
    score -= 18;
    flags.push('Stacking risk');
  } else if (activePositions.length === 2) {
    score -= 10;
    flags.push('Multiple active positions');
  }

  if (negativeDays >= 8) {
    score -= 14;
    flags.push('High negative-day count');
  } else if (negativeDays >= 4) score -= 7;

  if (nsfCount >= 8) {
    score -= 14;
    flags.push('High NSF count');
  } else if (nsfCount >= 3) score -= 6;

  if (missingDocs.length) {
    score -= Math.min(18, missingDocs.length * 5);
    flags.push(`${missingDocs.length} missing document${missingDocs.length === 1 ? '' : 's'}`);
  }

  if (HIGH_RISK_INDUSTRIES.some((item) => industry.includes(item))) {
    score -= 18;
    flags.push('Restricted or high-risk industry');
  }

  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  const tier = bounded >= 82 ? 'A' : bounded >= 68 ? 'B' : bounded >= 52 ? 'C' : bounded >= 35 ? 'D' : 'decline';
  const maxFunding = monthlyRevenue ? Math.round(monthlyRevenue * (tier === 'A' ? 1.25 : tier === 'B' ? 0.9 : tier === 'C' ? 0.6 : 0.35)) : 0;
  const maxDailyPayment = monthlyRevenue ? Math.round((monthlyRevenue / 22) * (tier === 'A' ? 0.18 : tier === 'B' ? 0.14 : tier === 'C' ? 0.1 : 0.06)) : 0;

  return {
    score: bounded,
    tier,
    flags: flags.length ? flags : ['No major flags'],
    maxFunding,
    maxDailyPayment,
    missingDocs,
    monthlyRevenue,
    timeInBusiness,
    activePositionCount: activePositions.length,
  };
}

export function getPartnerMatches(deal: RecordMap, partners: RecordMap[], documents: RecordMap[], positions: RecordMap[] = []) {
  const score = getDealScore(deal, documents, positions);
  const business = deal.businesses || {};
  const requested = numberValue(deal.requested_amount || deal.approved_amount);
  const state = String(business.state || '').trim().toUpperCase();
  const industry = normalize(business.industry);

  return partners
    .filter((partner) => partner.is_active !== false)
    .map((partner) => {
      const misses: string[] = [];
      const restricted = (partner.restricted_industries || []).map(normalize).filter(Boolean);
      const states = (partner.states_served || []).map((item: string) => item.trim().toUpperCase()).filter(Boolean);
      if (partner.min_funding_amount && requested < Number(partner.min_funding_amount)) misses.push('Below minimum funding');
      if (partner.max_funding_amount && requested > Number(partner.max_funding_amount)) misses.push('Above maximum funding');
      if (partner.min_monthly_revenue && score.monthlyRevenue < Number(partner.min_monthly_revenue)) misses.push('Revenue below partner minimum');
      if (partner.min_time_in_business_months && score.timeInBusiness && score.timeInBusiness < Number(partner.min_time_in_business_months)) misses.push('Time in business below minimum');
      if (states.length && state && !states.includes(state)) misses.push('State not served');
      if (restricted.some((item: string) => industry.includes(item))) misses.push('Restricted industry');
      const fitScore = Math.max(0, score.score - misses.length * 18 + (partner.avg_approval_days && Number(partner.avg_approval_days) <= 2 ? 4 : 0));
      return { partner, fitScore, misses };
    })
    .sort((a, b) => b.fitScore - a.fitScore);
}

export function getRenewalSignal(row: RecordMap) {
  const deal = row.deals || row;
  const fundedAmount = numberValue(row.original_funded_amount || deal.funded_amount);
  const currentBalance = numberValue(row.current_balance);
  const paidDown = numberValue(row.percent_paid_down || (fundedAmount && currentBalance ? ((fundedAmount - currentBalance) / fundedAmount) * 100 : 0));
  const fundedDate = deal.funded_at ? new Date(deal.funded_at) : null;
  const daysSinceFunding = fundedDate && !Number.isNaN(fundedDate.getTime()) ? Math.floor((Date.now() - fundedDate.getTime()) / 86400000) : 0;
  const status = paidDown >= 55 && daysSinceFunding >= 45 ? 'renewal_ready' : paidDown >= 40 ? 'renewal_soon' : 'monitor';
  const probability = Math.min(96, Math.max(20, Math.round(paidDown + Math.min(daysSinceFunding, 90) * 0.25)));
  const nextAction = status === 'renewal_ready' ? 'Refresh bank statements and prepare renewal offer.' : status === 'renewal_soon' ? 'Schedule merchant check-in before eligibility.' : 'Monitor paydown and payment behavior.';
  return { paidDown, daysSinceFunding, status, probability, nextAction };
}

export function getIsoQuality(broker: RecordMap, commissions: RecordMap[], deals: RecordMap[]) {
  const brokerCommissions = commissions.filter((row) => row.iso_broker_id === broker.id);
  const brokerDealIds = new Set(brokerCommissions.map((row) => row.deal_id).filter(Boolean));
  const brokerDeals = deals.filter((deal) => brokerDealIds.has(deal.id));
  const fundedDeals = brokerDeals.filter((deal) => deal.stage_slug === 'funded' || deal.funded_at);
  const declinedDeals = brokerDeals.filter((deal) => ['declined', 'lost_unresponsive', 'withdrawn'].includes(deal.stage_slug));
  const approvalRate = brokerDeals.length ? Math.round((fundedDeals.length / brokerDeals.length) * 100) : 0;
  const declineRate = brokerDeals.length ? Math.round((declinedDeals.length / brokerDeals.length) * 100) : 0;
  const fundedVolume = fundedDeals.reduce((sum, deal) => sum + numberValue(deal.funded_amount), 0);
  const score = Math.max(0, Math.min(100, approvalRate - Math.round(declineRate / 2) + (fundedVolume > 250000 ? 12 : fundedVolume > 100000 ? 6 : 0)));
  return { dealCount: brokerDeals.length, fundedCount: fundedDeals.length, approvalRate, declineRate, fundedVolume, score };
}
