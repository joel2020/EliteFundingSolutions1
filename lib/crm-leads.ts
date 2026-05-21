export const LEAD_SOURCES = ['website', 'referral', 'broker', 'iso', 'paid_ads', 'organic_search', 'cold_email', 'partner', 'manual_entry'] as const;
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'application_started', 'converted', 'lost', 'unresponsive'] as const;

type LeadSource = (typeof LEAD_SOURCES)[number];
type LeadStatus = (typeof LEAD_STATUSES)[number];

const LEAD_SOURCE_ALIASES: Record<string, LeadSource> = {
  manual: 'manual_entry',
  manual_entry: 'manual_entry',
  website: 'website',
  web: 'website',
  referral: 'referral',
  referral_partner: 'referral',
  partner_referral: 'referral',
  broker: 'broker',
  iso: 'iso',
  iso_broker: 'iso',
  paid_ads: 'paid_ads',
  paid: 'paid_ads',
  ads: 'paid_ads',
  organic: 'organic_search',
  organic_search: 'organic_search',
  cold_email: 'cold_email',
  email: 'cold_email',
  partner: 'partner',
};

const LEAD_STATUS_ALIASES: Record<string, LeadStatus> = {
  new: 'new',
  new_lead: 'new',
  contacted: 'contacted',
  qualified: 'qualified',
  application_started: 'application_started',
  app_started: 'application_started',
  converted: 'converted',
  lost: 'lost',
  unresponsive: 'unresponsive',
  lost_unresponsive: 'unresponsive',
};

function normalizeToken(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : value;
}

export function normalizeLeadSource(value: unknown) {
  const normalized = normalizeToken(value);
  return typeof normalized === 'string' ? LEAD_SOURCE_ALIASES[normalized] || normalized : normalized;
}

export function normalizeLeadStatus(value: unknown) {
  const normalized = normalizeToken(value);
  return typeof normalized === 'string' ? LEAD_STATUS_ALIASES[normalized] || normalized : normalized;
}
