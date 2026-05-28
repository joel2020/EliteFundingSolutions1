'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileArchive,
  FileText,
  Filter,
  LineChart as LineChartIcon,
  Mail,
  MoreHorizontal,
  Percent,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Eye,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';
import { CrmTopbar } from '@/components/crm/topbar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import {
  getComplianceBlocks,
  getDealScore,
  getDisclosureState,
  getIsoQuality,
  getMissingDocuments,
  getPartnerMatches,
  getRenewalSignal,
} from '@/lib/crm-intelligence';

type RecordMap = Record<string, any>;

type CrmDataset = {
  leads: RecordMap[];
  deals: RecordMap[];
  offers: RecordMap[];
  renewals: RecordMap[];
  commissions: RecordMap[];
  commissionRecipients: RecordMap[];
  riskEvents: RecordMap[];
  partners: RecordMap[];
  users: RecordMap[];
  isoBrokers: RecordMap[];
  activities: RecordMap[];
  documents: RecordMap[];
  notes: RecordMap[];
  partnerSubmissions: RecordMap[];
  currentPositions: RecordMap[];
  dealFinancials: RecordMap[];
  documentRequests: RecordMap[];
  tasks: RecordMap[];
  stipulations: RecordMap[];
  applications: RecordMap[];
  owners: RecordMap[];
};

const STAGES = [
  ['lead_captured', 'New'],
  ['documents_requested', 'Docs Needed'],
  ['application_submitted', 'Submitted'],
  ['underwriting_review', 'Under Review'],
  ['offers_received', 'Offer Received'],
  ['offer_presented', 'Offer Sent'],
  ['contract_sent', 'Contract Out'],
  ['contract_signed', 'Signed'],
  ['funded', 'Funded'],
  ['declined', 'Declined'],
  ['lost_unresponsive', 'Withdrawn'],
  ['renewal_eligible', 'Renewal Eligible'],
] as const;

const STAGE_LABELS = Object.fromEntries(STAGES);
const STAGE_OPTIONS = STAGES.map(([value, label]) => ({ value, label }));
const STATUS_COLORS = ['#0F2B5B', '#C9A84C', '#2563EB', '#059669', '#D97706', '#DC2626', '#64748B'];
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';
const LEAD_SOURCE_OPTIONS = [
  ['website', 'Website'],
  ['referral', 'Referral'],
  ['broker', 'Broker'],
  ['iso', 'ISO'],
  ['paid_ads', 'Paid ads'],
  ['organic_search', 'Organic search'],
  ['cold_email', 'Cold email'],
  ['partner', 'Partner'],
  ['manual_entry', 'Manual entry'],
] as const;

const emptyLead = {
  business_name: '',
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  lead_source: 'manual_entry',
  status: 'new',
  requested_amount: '',
  notes: '',
  assigned_user_id: '',
};

const emptyDeal = {
  title: '',
  requested_amount: '',
  approved_amount: '',
  funded_amount: '',
  stage_slug: 'lead_captured',
  assigned_user_id: '',
  junior_closer_id: '',
  senior_closer_id: '',
  iso_broker_id: '',
  lead_source: 'manual_entry',
  notes: '',
};


const DETAIL_DOCUMENT_TYPES = [
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'bank_statements', label: 'Bank Statements' },
  { value: 'license_verification', label: 'License Verification' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'signed_application', label: 'Signed Partner Application' },
  { value: 'completed_application', label: 'Completed Application' },
  { value: 'contract', label: 'Partner Contract' },
  { value: 'signed_contract', label: 'Signed Contract' },
  { value: 'other', label: 'Other' },
];

function detailDocTypeLabel(type: string) {
  return DETAIL_DOCUMENT_TYPES.find((item) => item.value === type)?.label || type.replaceAll('_', ' ');
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(fileName?: string) {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(extension || '')) return <FileArchive className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

const emptyUser = {
  first_name: '',
  last_name: '',
  email: '',
  role: 'sales_rep',
  permissions: [] as string[],
  is_active: true,
  referral_slug: '',
};

const USER_PERMISSION_OPTIONS = [
  ['send_to_lenders', 'Send deals to lenders'],
  ['manage_documents', 'Manage deal documents'],
  ['manage_commissions', 'Manage finance and commissions'],
  ['manage_users', 'Add and edit users'],
  ['reveal_sensitive', 'Reveal sensitive application data'],
  ['mark_defaulted', 'Mark funded deals defaulted'],
] as const;

function currency(value: any) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function pct(value: any) {
  return `${Math.round(Number(value || 0))}%`;
}

function date(value: any) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function monthsSinceDate(value?: string | null) {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
}

function formatTimeInBusiness(value?: string | null) {
  const months = monthsSinceDate(value);
  if (months === null) return 'Not set';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} month${rest === 1 ? '' : 's'}`;
  if (!rest) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years} year${years === 1 ? '' : 's'}, ${rest} month${rest === 1 ? '' : 's'}`;
}

function dealSummary(deal: RecordMap, app?: RecordMap, owners: RecordMap[] = []) {
  const business = deal.businesses || {};
  const owner = owners[0] || {};
  const pieces = [
    business.industry ? `${business.industry} business` : 'Merchant',
    business.city || business.state ? `based in ${[business.city, business.state].filter(Boolean).join(', ')}` : '',
    deal.requested_amount ? `requesting ${currency(deal.requested_amount)}` : '',
    owner.first_name || owner.last_name ? `primary owner ${[owner.first_name, owner.last_name].filter(Boolean).join(' ')}` : '',
    app?.funding_purpose ? `purpose: ${app.funding_purpose}` : '',
  ].filter(Boolean);
  return pieces.length ? `${pieces.join('. ')}.` : (deal.notes || business.notes || 'No client summary has been added yet.');
}

function publicRecordStatus(events: RecordMap[]) {
  const publicEvents = events.filter((event) => ['judgment', 'lien', 'tax_lien', 'bankruptcy', 'court_record', 'ucc', 'defaulted'].includes(String(event.event_type || '').toLowerCase()));
  const openEvents = publicEvents.filter((event) => !['cleared', 'resolved', 'paid', 'closed'].includes(String(event.status || '').toLowerCase()));
  if (!publicEvents.length) return { label: 'No outstanding issues', tone: 'emerald', events: [] as RecordMap[] };
  if (openEvents.length) return { label: 'Fail', tone: 'red', events: openEvents };
  return { label: 'Pass', tone: 'emerald', events: publicEvents };
}

function analysisMetric(financial: RecordMap, deal: RecordMap, keys: string[], fallback: any = null) {
  for (const key of keys) {
    if (financial[key] !== undefined && financial[key] !== null && financial[key] !== '') return financial[key];
    if (deal[key] !== undefined && deal[key] !== null && deal[key] !== '') return deal[key];
  }
  return fallback;
}

function lenderAcceptsPositionCount(partner: RecordMap, positionCount: number) {
  const raw = [
    partner.max_active_positions,
    partner.max_positions,
    partner.position_limit,
    partner.criteria_notes,
    partner.notes,
    partner.underwriting_notes,
  ].filter(Boolean).join(' ');
  const numericLimit = Number(partner.max_active_positions || partner.max_positions || partner.position_limit || 0);
  if (numericLimit > 0) return positionCount <= numericLimit;
  const acceptsAtLeast = raw.match(/accepts?\s+(\d+)\+?\s+(?:active\s+)?positions?/i) || raw.match(/(\d+)\+\s+(?:active\s+)?positions?/i);
  if (acceptsAtLeast?.[1] && raw.includes('+')) return positionCount >= Number(acceptsAtLeast[1]);
  const maxMention = raw.match(/max(?:imum)?\s+(\d+)\s+(?:active\s+)?positions?/i);
  if (maxMention?.[1]) return positionCount <= Number(maxMention[1]);
  return true;
}

function lenderAcceptsFinancials(partner: RecordMap, financial: RecordMap) {
  if (partner.min_average_daily_balance && Number(financial.average_daily_ledger_balance || 0) < Number(partner.min_average_daily_balance)) return false;
  if (partner.max_negative_balance_days != null && Number(financial.negative_balance_days_per_month || 0) > Number(partner.max_negative_balance_days)) return false;
  if (partner.max_nsf_count != null && Number(financial.nsf_count || 0) > Number(partner.max_nsf_count)) return false;
  return true;
}

function shortId(id?: string) {
  return id ? id.slice(0, 8).toUpperCase() : 'UNASSIGNED';
}

function repReferralUrl(slug?: string | null) {
  if (!slug) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/apply/rep/${slug}`;
}

function repReferralDisplayUrl(slug?: string | null) {
  return repReferralUrl(slug) || 'Not generated';
}

function businessName(row: RecordMap) {
  return row.businesses?.dba || row.businesses?.legal_name || row.business_name || row.title || 'Unnamed merchant';
}

function repName(row: RecordMap) {
  const user = row.user_profiles || row.assigned_rep || row.rep;
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Unassigned';
}

function partnerName(row: RecordMap) {
  return row.funding_partners?.name || row.partner_name || 'Unassigned';
}

function isoBrokerName(row?: RecordMap | null) {
  if (!row) return 'Unassigned';
  return [row.company_name, row.broker_name].filter(Boolean).join(' - ') || row.email || 'Unassigned';
}

function stageLabel(stage?: string) {
  return stage ? STAGE_LABELS[stage] || stage.replaceAll('_', ' ') : 'New';
}

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function StatusBadge({ value }: { value?: string | null }) {
  const raw = value || 'new';
  const label = stageLabel(raw);
  const key = normalize(raw);
  const color =
    key.includes('funded') || key.includes('paid') || key.includes('eligible') ? '#059669' :
    key.includes('offer') || key.includes('signed') || key.includes('approved') ? '#2563EB' :
    key.includes('review') || key.includes('submitted') ? '#7C3AED' :
    key.includes('declined') || key.includes('lost') || key.includes('withdrawn') || key.includes('overdue') ? '#DC2626' :
    key.includes('docs') || key.includes('contract') || key.includes('pending') ? '#D97706' :
    '#64748B';
  return (
    <span className="inline-flex min-w-[92px] items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" style={{ color, borderColor: `${color}35`, background: `${color}12` }}>
      {label}
    </span>
  );
}

function CrmCard({ children, className = '', ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`crm-panel ${className}`}>{children}</section>;
}

function MetricCard({ title, value, subtitle, icon, tone = '#0F2B5B', href }: { title: string; value: string | number; subtitle: string; icon: React.ReactNode; tone?: string; href?: string }) {
  const content = (
    <CrmCard className="group p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="crm-kicker">{title}</p>
          <p className="mt-2 truncate text-[26px] font-bold tracking-[-0.02em] text-[#0F172A]">{value}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white shadow-sm transition-transform group-hover:scale-105" style={{ background: `${tone}12`, color: tone }}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-[12px] font-medium text-[#64748B]">{subtitle}</p>
    </CrmCard>
  );
  if (!href) return content;
  return (
    <Link href={href} className="crm-focus-ring block rounded-[14px]">
      {content}
    </Link>
  );
}

function Toolbar({ search, setSearch, children }: { search: string; setSearch: (value: string) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#E2E8F0] bg-white/80 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-[420px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search merchants, reps, IDs, partners..." className="h-10 rounded-[9px] border-[#CBD5E1] bg-[#F8FAFC] pl-9 text-[13px] font-medium shadow-inner focus:bg-white" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {search && <Button variant="outline" className="h-10 rounded-[9px]" onClick={() => setSearch('')}>Clear</Button>}
        {children}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] shadow-sm"><FileArchive className="h-5 w-5" /></div>
      <p className="mt-4 text-sm font-bold text-[#0F172A]">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[#64748B]">{body}</p>
    </div>
  );
}

function exportCsv(name: string, rows: RecordMap[]) {
  const keys = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  if (!keys.length) {
    keys.push('status');
    rows = [{ status: 'No rows available for this export' }];
  }
  const csv = [keys.join(','), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseLeadCsv(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => normalize(header).replaceAll(' ', '_'));
  const aliases: Record<string, string> = {
    company: 'business_name',
    business: 'business_name',
    business_name: 'business_name',
    first: 'first_name',
    first_name: 'first_name',
    last: 'last_name',
    last_name: 'last_name',
    contact_first_name: 'first_name',
    contact_last_name: 'last_name',
    mobile: 'phone',
    phone_number: 'phone',
    phone: 'phone',
    email_address: 'email',
    email: 'email',
    source: 'lead_source',
    lead_source: 'lead_source',
    amount: 'requested_amount',
    requested_amount: 'requested_amount',
    notes: 'notes',
    status: 'status',
  };
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<RecordMap>((row, header, index) => {
      const key = aliases[header] || header;
      row[key] = values[index] || '';
      return row;
    }, {});
  }).filter((row) => row.business_name || row.first_name || row.last_name || row.email || row.phone);
}

export function useCrmDataset() {
  const { profile, organizationId, loading: profileLoading, error: profileError } = useCrmUser();
  const browserSupabase = useMemo(() => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CrmDataset>({
    leads: [],
    deals: [],
    offers: [],
    renewals: [],
    commissions: [],
    commissionRecipients: [],
    riskEvents: [],
    partners: [],
    users: [],
    isoBrokers: [],
    activities: [],
    documents: [],
    notes: [],
    partnerSubmissions: [],
    currentPositions: [],
    dealFinancials: [],
    documentRequests: [],
    tasks: [],
    stipulations: [],
    applications: [],
    owners: [],
  });

  const load = useCallback(async () => {
    const org = organizationId || ORG_ID;
    setLoading(true);
    setError(null);

    const settled = await Promise.allSettled([
      browserSupabase.from('leads').select('*').eq('organization_id', org).is('deleted_at', null).order('created_at', { ascending: false }),
      browserSupabase.from('deals').select('*').eq('organization_id', org).is('deleted_at', null).order('created_at', { ascending: false }),
      browserSupabase.from('offers').select('*').eq('organization_id', org).order('created_at', { ascending: false }),
      browserSupabase.from('renewals').select('*').eq('organization_id', org).order('updated_at', { ascending: false }),
      browserSupabase.from('commissions').select('*').eq('organization_id', org).order('created_at', { ascending: false }),
      browserSupabase.from('funding_partners').select('*').eq('organization_id', org).order('name'),
      browserSupabase.from('user_profiles').select('*').eq('organization_id', org).order('first_name'),
      browserSupabase.from('activities').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      browserSupabase.from('documents').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      browserSupabase.from('notes').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      browserSupabase.from('partner_submissions').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      browserSupabase.from('current_positions').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      browserSupabase.from('deal_financials').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      browserSupabase.from('businesses').select('*').eq('organization_id', org).is('deleted_at', null),
      browserSupabase.from('document_requests').select('*').eq('organization_id', org).order('updated_at', { ascending: false }).limit(200),
      browserSupabase.from('tasks').select('*').eq('organization_id', org).order('due_date', { ascending: true }).limit(200),
      browserSupabase.from('stipulations').select('*').eq('organization_id', org).order('updated_at', { ascending: false }).limit(200),
      browserSupabase.from('applications').select('*').eq('organization_id', org).is('deleted_at', null).limit(200),
      browserSupabase.from('owners').select('*').eq('organization_id', org).is('deleted_at', null).limit(200),
      browserSupabase.from('commission_recipients').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(200),
      browserSupabase.from('deal_risk_events').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(200),
      browserSupabase.from('iso_brokers').select('*').eq('organization_id', org).eq('is_active', true).is('deleted_at', null).order('company_name'),
    ]);

    const unwrap = (index: number) => {
      const item = settled[index];
      if (item.status !== 'fulfilled') return [];
      if ((item.value as any).error) return [];
      return (item.value as any).data || [];
    };

    const hardError = settled.slice(0, 9).find((item) => item.status === 'fulfilled' && (item.value as any).error && !['notes', 'current_positions', 'deal_financials'].includes((item.value as any).error?.details || ''));
    if (hardError?.status === 'fulfilled' && (hardError.value as any).error?.code !== '42P01') {
      setError((hardError.value as any).error.message);
    }

    const rawLeads = unwrap(0);
    const rawDeals = unwrap(1);
    const rawOffers = unwrap(2);
    const rawRenewals = unwrap(3);
    const rawCommissions = unwrap(4);
    const partners = unwrap(5);
    const users = unwrap(6);
    const businesses = unwrap(13);
    const usersById = Object.fromEntries(users.map((user: RecordMap) => [user.id, user]));
    const partnersById = Object.fromEntries(partners.map((partner: RecordMap) => [partner.id, partner]));
    const isoBrokers = unwrap(21);
    const isoBrokersById = Object.fromEntries(isoBrokers.map((broker: RecordMap) => [broker.id, broker]));
    const businessesById = Object.fromEntries(businesses.map((business: RecordMap) => [business.id, business]));
    const offers = rawOffers.map((offer: RecordMap) => ({ ...offer, funding_partners: partnersById[offer.funding_partner_id] }));
    const renewals = rawRenewals.map((renewal: RecordMap) => ({ ...renewal, user_profiles: usersById[renewal.assigned_user_id] }));
    const deals = rawDeals.map((deal: RecordMap) => ({
      ...deal,
      businesses: businessesById[deal.business_id],
      user_profiles: usersById[deal.assigned_user_id],
      iso_brokers: isoBrokersById[deal.iso_broker_id],
      offers: offers.filter((offer: RecordMap) => offer.deal_id === deal.id),
      renewals: renewals.filter((renewal: RecordMap) => renewal.original_deal_id === deal.id),
    }));
    const dealsById = Object.fromEntries(deals.map((deal: RecordMap) => [deal.id, deal]));
    const offersById = Object.fromEntries(offers.map((offer: RecordMap) => [offer.id, offer]));
    const commissions = rawCommissions.map((commission: RecordMap) => ({
      ...commission,
      deals: dealsById[commission.deal_id],
      offers: offersById[commission.offer_id],
      user_profiles: usersById[commission.rep_id],
    }));
    const leads = rawLeads.map((lead: RecordMap) => ({ ...lead, user_profiles: usersById[lead.assigned_user_id] }));

    setData({
      leads,
      deals,
      offers,
      renewals: renewals.map((renewal: RecordMap) => ({ ...renewal, deals: dealsById[renewal.original_deal_id] })),
      commissions,
      partners,
      users,
      isoBrokers,
      activities: unwrap(7),
      documents: unwrap(8),
      notes: unwrap(9),
      partnerSubmissions: unwrap(10).map((submission: RecordMap) => ({ ...submission, funding_partners: partnersById[submission.funding_partner_id] })),
      currentPositions: unwrap(11),
      dealFinancials: unwrap(12),
      documentRequests: unwrap(14).map((request: RecordMap) => ({ ...request, assigned_user: usersById[request.assigned_user_id] })),
      tasks: unwrap(15).map((task: RecordMap) => ({ ...task, assigned_user: usersById[task.assigned_user_id] })),
      stipulations: unwrap(16).map((stip: RecordMap) => ({ ...stip, assigned_user: usersById[stip.assigned_user_id] })),
      applications: unwrap(17),
      owners: unwrap(18),
      commissionRecipients: unwrap(19).map((row: RecordMap) => ({ ...row, user_profiles: usersById[row.recipient_user_profile_id] })),
      riskEvents: unwrap(20).map((row: RecordMap) => ({ ...row, funding_partners: partnersById[row.funding_partner_id] })),
    });
    setLoading(false);
  }, [browserSupabase, organizationId]);

  useEffect(() => {
    if (profileLoading) return;
    load();
  }, [profileLoading, load]);

  return { ...data, profile, organizationId: organizationId || ORG_ID, loading: loading || profileLoading, error: error || profileError, reload: load } as CrmDataset & {
    profile: typeof profile;
    organizationId: string;
    loading: boolean;
    error: string | null;
    reload: () => Promise<void>;
  };
}

function LoadingScreen({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar title={title} subtitle="Loading CRM workspace..." />
      <div className="grid gap-4 p-5 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[14px] border border-[#E2E8F0] bg-white/70" />)}
      </div>
    </div>
  );
}

function PageFrame({ title, subtitle, actions, children }: { title: string; subtitle: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid={`crm-page-${normalize(title).replaceAll(' ', '-')}`}>
      <CrmTopbar title={title} subtitle={subtitle} actions={actions} />
      <div className="crm-shell-bg flex-1 overflow-y-auto p-4 md:p-6">
        {children}
      </div>
    </div>
  );
}

export function CrmDashboardExperience() {
  const { leads, deals, offers, renewals, commissions, partners, users, activities, loading, error } = useCrmDataset();
  if (loading) return <LoadingScreen title="Dashboard" />;

  const fundedDeals = deals.filter((deal: RecordMap) => deal.stage_slug === 'funded' || deal.funded_at);
  const activeDeals = deals.filter((deal: RecordMap) => !['funded', 'declined', 'lost_unresponsive'].includes(deal.stage_slug));
  const totalFunded = fundedDeals.reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0);
  const pendingOffers = offers.filter((offer: RecordMap) => ['received', 'presented'].includes(offer.status)).length;
  const approvalRate = deals.length ? Math.round((deals.filter((deal: RecordMap) => ['offers_received', 'offer_presented', 'contract_sent', 'contract_signed', 'funded'].includes(deal.stage_slug)).length / deals.length) * 100) : 0;
  const estimatedEarnings = commissions.reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0);
  const paidEarnings = commissions.filter((row: RecordMap) => row.payment_status === 'paid').reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0);
  const stageData = STAGE_OPTIONS.map((stage) => ({ name: stage.label, value: deals.filter((deal: RecordMap) => deal.stage_slug === stage.value).length }));
  const partnerData = partners.slice(0, 5).map((partner: RecordMap) => ({ name: partner.name, value: offers.filter((offer: RecordMap) => offer.funding_partner_id === partner.id).length || 1 }));
  const repData = users.filter((user: RecordMap) => user.role !== 'client' && user.is_active && !user.deleted_at).slice(0, 6).map((user: RecordMap) => ({
    name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
    deals: deals.filter((deal: RecordMap) => deal.assigned_user_id === user.id).length,
    funded: deals.filter((deal: RecordMap) => deal.assigned_user_id === user.id).reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0),
  }));
  const attention = deals.filter((deal: RecordMap) => ['documents_requested', 'underwriting_review', 'contract_sent'].includes(deal.stage_slug)).slice(0, 6);

  return (
    <PageFrame title="Executive Dashboard" subtitle="MCA pipeline, production, renewals, and earnings at a glance">
      {error && <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total Leads" value={leads.length} subtitle="All active lead records" icon={<Users className="h-4 w-4" />} href="/crm/leads" />
        <MetricCard title="Active Deals" value={activeDeals.length} subtitle="Open funding pipeline" icon={<Briefcase className="h-4 w-4" />} tone="#2563EB" href="/crm/deals" />
        <MetricCard title="Deals Funded" value={fundedDeals.length} subtitle="Closed funded deals" icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" href="/crm/deals" />
        <MetricCard title="Total Funded Volume" value={currency(totalFunded)} subtitle="Lifetime funded volume" icon={<TrendingUp className="h-4 w-4" />} tone="#0F766E" href="/crm/reports" />
        <MetricCard title="Pending Offers" value={pendingOffers} subtitle="Received or presented" icon={<FileText className="h-4 w-4" />} tone="#D97706" href="/crm/offers" />
        <MetricCard title="Approval Rate" value={pct(approvalRate)} subtitle="Offer-or-better conversion" icon={<Percent className="h-4 w-4" />} tone="#7C3AED" href="/crm/reports" />
        <MetricCard title="Renewal Opportunities" value={renewals.length} subtitle="Tracked renewal records" icon={<RefreshCw className="h-4 w-4" />} tone="#0891B2" href="/crm/renewals" />
        <MetricCard title="Estimated Earnings" value={currency(estimatedEarnings)} subtitle="Gross commission booked" icon={<WalletCards className="h-4 w-4" />} tone="#C9A84C" href="/crm/earnings" />
        <MetricCard title="Paid Earnings" value={currency(paidEarnings)} subtitle="Commission received" icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" href="/crm/earnings" />
        <MetricCard title="Needs Attention" value={attention.length} subtitle="Docs, UW, or contracts" icon={<AlertTriangle className="h-4 w-4" />} tone="#DC2626" href="/crm/deals" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <CrmCard className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-sm font-semibold text-[#0F172A]">Deals by Stage</h2><p className="text-xs text-[#64748B]">Broker pipeline distribution</p></div>
            <Link href="/crm/deals" className="text-xs font-semibold text-[#0F2B5B]">Open deals</Link>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stageData}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="name" angle={-35} height={82} interval={0} textAnchor="end" tick={{ fontSize: 10, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#0F2B5B" />
            </BarChart>
          </ResponsiveContainer>
        </CrmCard>

        <CrmCard className="p-4">
          <h2 className="text-sm font-semibold text-[#0F172A]">Top Funding Partners</h2>
          <p className="text-xs text-[#64748B]">Offer activity by lender</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={partnerData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                  {partnerData.map((_: RecordMap, index: number) => <Cell key={index} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CrmCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <CrmCard className="xl:col-span-2">
          <div className="border-b border-[#E2E8F0] p-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">Deals Requiring Attention</h2>
            <p className="text-xs text-[#64748B]">Files most likely to stall without follow-up</p>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {attention.length ? attention.map((deal: RecordMap) => (
              <Link key={deal.id} href={`/crm/deals/${deal.id}`} className="grid gap-3 p-4 text-sm hover:bg-[#F8FAFC] md:grid-cols-[1fr_140px_130px_110px] md:items-center">
                <div><p className="font-semibold text-[#0F172A]">{businessName(deal)}</p><p className="text-xs text-[#64748B]">Deal {shortId(deal.id)} · {repName(deal)}</p></div>
                <div className="font-semibold text-[#0F172A]">{currency(deal.requested_amount)}</div>
                <StatusBadge value={deal.stage_slug} />
                <div className="text-xs text-[#64748B]">{date(deal.updated_at)}</div>
              </Link>
            )) : <EmptyState title="No urgent deals" body="Docs, underwriting, and contracts are clear right now." />}
          </div>
        </CrmCard>

        <CrmCard>
          <div className="border-b border-[#E2E8F0] p-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">Recent Activity</h2>
            <p className="text-xs text-[#64748B]">Latest CRM movement</p>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {(activities.length ? activities : deals.slice(0, 6)).slice(0, 6).map((item: RecordMap) => (
              <div key={item.id} className="p-4 text-sm">
                <p className="font-medium text-[#0F172A]">{item.title || item.action || `${businessName(item)} updated`}</p>
                <p className="mt-1 text-xs text-[#64748B]">{date(item.created_at || item.updated_at)}</p>
              </div>
            ))}
          </div>
        </CrmCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CrmCard className="p-4">
          <h2 className="text-sm font-semibold text-[#0F172A]">Top Sales Reps</h2>
          <div className="mt-4 space-y-3">
            {repData.map((rep: RecordMap) => (
              <div key={rep.name} className="grid grid-cols-[1fr_70px_120px] items-center gap-3 text-sm">
                <span className="truncate font-medium text-[#0F172A]">{rep.name}</span>
                <span className="text-right text-[#64748B]">{rep.deals} deals</span>
                <span className="text-right font-semibold text-[#0F172A]">{currency(rep.funded)}</span>
              </div>
            ))}
          </div>
        </CrmCard>
        <CrmCard className="p-4">
          <h2 className="text-sm font-semibold text-[#0F172A]">Broker Control Center</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              ['Add Lead', '/crm/leads', Plus],
              ['Advanced Search', '/crm/tools', Search],
              ['Renewal Pipeline', '/crm/renewals', RefreshCw],
              ['Earnings', '/crm/earnings', WalletCards],
            ].map(([label, href, Icon]: any) => (
              <Link key={label} href={href} className="flex items-center justify-between rounded-[8px] border border-[#E2E8F0] p-3 text-sm font-semibold text-[#0F172A] hover:border-[#C9A84C] hover:bg-[#FFFBEB]">
                <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-[#0F2B5B]" />{label}</span>
                <ArrowRight className="h-4 w-4 text-[#94A3B8]" />
              </Link>
            ))}
          </div>
        </CrmCard>
      </div>
    </PageFrame>
  );
}

export function CrmLeadsExperience() {
  const { leads, users, organizationId, loading, reload } = useCrmDataset();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<RecordMap[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<RecordMap | null>(null);
  const [form, setForm] = useState<RecordMap>(emptyLead);
  if (loading) return <LoadingScreen title="Leads" />;

  const filtered = leads.filter((lead: RecordMap) => {
    const query = normalize(search);
    const statusMatch = status === 'all' || lead.status === status;
    const text = normalize([lead.business_name, lead.first_name, lead.last_name, lead.email, lead.phone, lead.lead_source].filter(Boolean).join(' '));
    return statusMatch && (!query || text.includes(query));
  });

  const openLead = (lead?: RecordMap) => {
    setEditing(lead || null);
    setForm(lead ? { ...emptyLead, ...lead, assigned_user_id: lead.assigned_user_id || '' } : emptyLead);
    setDialogOpen(true);
  };

  const saveLead = async () => {
    const payload = {
      business_name: form.business_name,
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      email: form.email,
      lead_source: form.lead_source,
      status: form.status,
      notes: form.notes,
      requested_amount: form.requested_amount ? Number(form.requested_amount) : null,
      assigned_user_id: form.assigned_user_id || null,
      organization_id: organizationId,
    };
    const response = await fetch(editing ? `/api/crm/leads/${editing.id}` : '/api/crm/leads', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to save lead');
    else {
      toast.success(editing ? 'Lead updated' : 'Lead added');
      setDialogOpen(false);
      reload();
    }
  };

  const convertLead = async (lead: RecordMap) => {
    const response = await fetch(`/api/crm/leads/${lead.id}/convert`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to convert lead');
    else {
      toast.success('Lead converted to deal');
      reload();
    }
  };

  const readImportFile = async (file?: File | null) => {
    setImportError('');
    setImportRows([]);
    setImportFileName(file?.name || '');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Upload a CSV file.');
      return;
    }
    const rows = parseLeadCsv(await file.text());
    if (!rows.length) {
      setImportError('No importable leads found. Include a header row and at least one lead row.');
      return;
    }
    setImportRows(rows);
  };

  const importLeads = async () => {
    if (!importRows.length) {
      setImportError('Choose a CSV with at least one lead.');
      return;
    }
    setImporting(true);
    const payload = importRows.map((row) => ({
      organization_id: organizationId,
      business_name: row.business_name || null,
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      phone: row.phone || null,
      email: row.email || null,
      lead_source: row.lead_source || 'manual_entry',
      status: row.status || 'new',
      requested_amount: row.requested_amount ? Number(String(row.requested_amount).replace(/[$,]/g, '')) || null : null,
      notes: row.notes || null,
    }));
    const response = await fetch('/api/crm/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || !result.success) {
      toast.error(result.error || 'Unable to import leads');
    } else {
      toast.success(`${payload.length} leads imported`);
      setImportOpen(false);
      setImportRows([]);
      setImportFileName('');
      reload();
    }
    setImporting(false);
  };

  return (
    <PageFrame title="Leads" subtitle="Lead-only prospects before they become submitted Pipeline deals" actions={<div className="flex gap-2"><Button data-testid="import-leads" variant="outline" className="h-9 rounded-[7px]" onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Import CSV</Button><Button data-testid="add-lead" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={() => openLead()}><Plus className="mr-2 h-4 w-4" />Add lead</Button></div>}>
      <CrmCard>
        <Toolbar search={search} setSearch={setSearch}>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 w-[170px] rounded-[7px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {['new', 'contacted', 'qualified', 'application_started', 'converted', 'lost', 'unresponsive'].map((item) => <SelectItem key={item} value={item}>{stageLabel(item)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-10 rounded-[7px]" onClick={() => exportCsv('leads', filtered)}><Download className="mr-2 h-4 w-4" />Export</Button>
        </Toolbar>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-normal text-[#64748B]">
              <tr>
                {['Business', 'Contact', 'Phone', 'Email', 'Source', 'Status', 'Assigned Rep', 'Requested', 'Created', 'Actions'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filtered.map((lead: RecordMap) => (
                <tr key={lead.id} className="hover:bg-[#F8FAFC]" data-testid={`lead-row-${lead.id}`}>
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">{lead.business_name || 'No business yet'}</td>
                  <td className="px-4 py-3 text-[#334155]">{[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown'}</td>
                  <td className="px-4 py-3 text-[#334155]">{lead.phone || 'No phone'}</td>
                  <td className="px-4 py-3 text-[#334155]">{lead.email || 'No email'}</td>
                  <td className="px-4 py-3 capitalize text-[#334155]">{(lead.lead_source || 'manual').replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3"><StatusBadge value={lead.status} /></td>
                  <td className="px-4 py-3 text-[#334155]">{repName(lead)}</td>
                  <td className="px-4 py-3 font-semibold text-[#0F172A]">{currency(lead.requested_amount)}</td>
                  <td className="px-4 py-3 text-[#64748B]">{date(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => openLead(lead)}>Edit</Button>
                      <Button data-testid={`convert-lead-${lead.id}`} variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => convertLead(lead)}>Convert</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <EmptyState title="No leads found" body="Add a lead or adjust filters to see more records." />}
        </div>
      </CrmCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl rounded-[8px]">
          <DialogHeader><DialogTitle>{editing ? 'Edit lead' : 'Add lead'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Business name', 'business_name'],
              ['Contact first name', 'first_name'],
              ['Contact last name', 'last_name'],
              ['Phone', 'phone'],
              ['Email', 'email'],
              ['Requested amount', 'requested_amount'],
            ].map(([label, key]) => (
              <div key={key}>
                <Label className="text-xs text-[#64748B]">{label}</Label>
                <Input data-testid={`lead-${key}`} value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 rounded-[7px]" />
              </div>
            ))}
            <div>
              <Label className="text-xs text-[#64748B]">Lead source</Label>
              <Select value={form.lead_source || 'manual_entry'} onValueChange={(value) => setForm({ ...form, lead_source: value })}>
                <SelectTrigger data-testid="lead-source" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_SOURCE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#64748B]">Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>{['new', 'contacted', 'qualified', 'application_started', 'converted', 'lost', 'unresponsive'].map((item) => <SelectItem key={item} value={item}>{stageLabel(item)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#64748B]">Assigned rep</Label>
              <Select value={form.assigned_user_id || 'unassigned'} onValueChange={(value) => setForm({ ...form, assigned_user_id: value === 'unassigned' ? '' : value })}>
                <SelectTrigger className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.filter((user: RecordMap) => user.role !== 'client').map((user: RecordMap) => <SelectItem key={user.id} value={user.id}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-[#64748B]">Internal notes</Label>
              <Textarea data-testid="lead-notes" value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-[96px] rounded-[7px]" />
            </div>
          </div>
          <DialogFooter><Button data-testid="save-lead" onClick={saveLead} className="rounded-[7px] bg-[#0F2B5B]">Save lead</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl rounded-[8px]">
          <DialogHeader><DialogTitle>Import leads from CSV</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#475569]">
              Required: one row per lead. Supported columns: business_name, first_name, last_name, phone, email, lead_source, requested_amount, notes, status.
            </div>
            <Input data-testid="lead-import-file" type="file" accept=".csv,text/csv" onChange={(event) => readImportFile(event.target.files?.[0])} />
            {importFileName && <p className="text-sm text-[#64748B]">{importFileName}</p>}
            {importError && <p className="text-sm font-semibold text-[#DC2626]">{importError}</p>}
            {importRows.length > 0 && (
              <div className="max-h-[260px] overflow-y-auto rounded-[8px] border border-[#E2E8F0]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr>{['Business', 'Contact', 'Phone', 'Email', 'Amount'].map((head) => <th key={head} className="px-3 py-2">{head}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[#E2E8F0]">{importRows.slice(0, 8).map((row, index) => <tr key={`${row.email}-${index}`}><td className="px-3 py-2 font-semibold">{row.business_name || '-'}</td><td className="px-3 py-2">{[row.first_name, row.last_name].filter(Boolean).join(' ') || '-'}</td><td className="px-3 py-2">{row.phone || '-'}</td><td className="px-3 py-2">{row.email || '-'}</td><td className="px-3 py-2">{row.requested_amount || '-'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button><Button data-testid="save-lead-import" onClick={importLeads} disabled={importing || !importRows.length}>{importing ? 'Importing...' : `Import ${importRows.length || ''} leads`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}

function DealTable({ rows, documents, currentPositions }: { rows: RecordMap[]; documents: RecordMap[]; currentPositions: RecordMap[] }) {
  return (
    <div className="crm-scroll-shadow overflow-x-auto">
      <table className="crm-table min-w-[1560px]">
        <thead>
          <tr>
            {['Deal ID', 'Business', 'Score', 'Missing Docs', 'Requested', 'Offered', 'Funded', 'Stage', 'Offer', 'Funded Status', 'Renewal', 'Current Balance', '% Paid', 'Assigned Rep', 'Funding Partner', 'Last Activity', 'Created'].map((head) => <th key={head}>{head}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((deal) => {
            const offer = Array.isArray(deal.offers) ? deal.offers[0] : null;
            const renewal = Array.isArray(deal.renewals) ? deal.renewals[0] : null;
            const dealDocs = documents.filter((doc: RecordMap) => doc.deal_id === deal.id || doc.application_id === deal.application_id);
            const positions = currentPositions.filter((row: RecordMap) => row.deal_id === deal.id || row.business_id === deal.business_id);
            const score = getDealScore(deal, dealDocs, positions);
            const currentBalance = renewal?.current_balance || Math.max(Number(offer?.payback_amount || deal.funded_amount || 0) - Number(deal.funded_amount || 0) * 0.45, 0);
            const percentPaid = renewal?.percent_paid_down || (deal.stage_slug === 'funded' ? 55 : 0);
            return (
              <tr key={deal.id} data-testid={`deal-row-${deal.id}`}>
                <td><Link href={`/crm/deals/${deal.id}`} className="font-bold text-[#0F2B5B] hover:underline">{shortId(deal.id)}</Link></td>
                <td className="font-bold text-[#0F172A]">{businessName(deal)}</td>
                <td><span className={`font-bold ${score.score >= 70 ? 'text-[#059669]' : score.score >= 50 ? 'text-[#D97706]' : 'text-[#DC2626]'}`}>{score.score}</span><span className="ml-1 text-xs text-[#64748B]">{score.tier}</span></td>
                <td>{score.missingDocs.length ? <span className="font-bold text-[#D97706]">{score.missingDocs.length}</span> : <span className="font-bold text-[#059669]">Clear</span>}</td>
                <td className="font-bold text-[#0F172A]">{currency(deal.requested_amount)}</td>
                <td>{currency(offer?.approved_amount || deal.approved_amount)}</td>
                <td>{currency(deal.funded_amount)}</td>
                <td><StatusBadge value={deal.stage_slug} /></td>
                <td><StatusBadge value={offer?.status || 'pending'} /></td>
                <td><StatusBadge value={deal.funded_at ? 'funded' : 'not funded'} /></td>
                <td><StatusBadge value={renewal?.status || (deal.stage_slug === 'renewal_eligible' ? 'eligible' : 'not eligible')} /></td>
                <td>{currency(currentBalance)}</td>
                <td>{pct(percentPaid)}</td>
                <td>{repName(deal)}</td>
                <td>{offer?.funding_partners?.name || partnerName(deal)}</td>
                <td className="text-[#64748B]">{date(deal.updated_at)}</td>
                <td className="text-[#64748B]">{date(deal.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <EmptyState title="No deals found" body="Adjust filters or convert leads to start building the MCA pipeline." />}
    </div>
  );
}

export function CrmDealsExperience() {
  const { deals, users, isoBrokers, documents, currentPositions, organizationId, loading, reload } = useCrmDataset();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RecordMap>(emptyDeal);
  if (loading) return <LoadingScreen title="Deals" />;
  const filtered = deals.filter((deal: RecordMap) => {
    const query = normalize(search);
    const statusMatch = stage === 'all' || deal.stage_slug === stage;
    const text = normalize([deal.id, businessName(deal), repName(deal), partnerName(deal), deal.stage_slug].join(' '));
    return statusMatch && (!query || text.includes(query));
  });

  const saveDeal = async () => {
    const payload = {
      title: form.title || 'New deal',
      business_name: form.title || 'New deal',
      requested_amount: form.requested_amount ? Number(form.requested_amount) : null,
      approved_amount: form.approved_amount ? Number(form.approved_amount) : null,
      funded_amount: form.funded_amount ? Number(form.funded_amount) : null,
      stage_slug: form.stage_slug || 'lead_captured',
      assigned_user_id: form.assigned_user_id || null,
      junior_closer_id: form.junior_closer_id || null,
      senior_closer_id: form.senior_closer_id || null,
      iso_broker_id: form.iso_broker_id || null,
      lead_source: form.lead_source || 'manual_entry',
      notes: form.notes || null,
    };
    const response = await fetch('/api/crm/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to add deal');
    else {
      toast.success('Deal added');
      setDialogOpen(false);
      setForm(emptyDeal);
      reload();
    }
  };

  return (
    <PageFrame title="Deals" subtitle="MCA deal board with offer, funded, renewal, and balance tracking" actions={<Button data-testid="new-deal" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New deal</Button>}>
      <CrmCard>
        <Toolbar search={search} setSearch={setSearch}>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="h-10 w-[190px] rounded-[7px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All stages</SelectItem>{STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" className="h-10 rounded-[7px]" onClick={() => exportCsv('deals', filtered)}><Download className="mr-2 h-4 w-4" />Export</Button>
        </Toolbar>
        <DealTable rows={filtered} documents={documents} currentPositions={currentPositions} />
      </CrmCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl rounded-[8px]">
          <DialogHeader><DialogTitle>New deal</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Title', 'title'],
              ['Requested amount', 'requested_amount'],
              ['Approved amount', 'approved_amount'],
              ['Funded amount', 'funded_amount'],
            ].map(([label, key]) => (
              <div key={key}>
                <Label className="text-xs text-[#64748B]">{label}</Label>
                <Input data-testid={`deal-${key}`} value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 rounded-[7px]" />
              </div>
            ))}
            <div>
              <Label className="text-xs text-[#64748B]">Stage</Label>
              <Select value={form.stage_slug} onValueChange={(value) => setForm({ ...form, stage_slug: value })}>
                <SelectTrigger data-testid="deal-stage" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>{STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#64748B]">Lead source</Label>
              <Select value={form.lead_source || 'manual_entry'} onValueChange={(value) => setForm({ ...form, lead_source: value })}>
                <SelectTrigger data-testid="deal-lead-source" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_SOURCE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#64748B]">Broker / ISO</Label>
              <Select value={form.iso_broker_id || 'none'} onValueChange={(value) => setForm({ ...form, iso_broker_id: value === 'none' ? '' : value, lead_source: value === 'none' ? form.lead_source : 'iso' })}>
                <SelectTrigger data-testid="deal-iso-broker" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No broker</SelectItem>
                  {isoBrokers.map((broker: RecordMap) => <SelectItem key={broker.id} value={broker.id}>{isoBrokerName(broker)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#64748B]">Assigned rep</Label>
              <Select value={form.assigned_user_id || 'unassigned'} onValueChange={(value) => setForm({ ...form, assigned_user_id: value === 'unassigned' ? '' : value })}>
                <SelectTrigger data-testid="deal-assigned-rep" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.filter((user: RecordMap) => user.role !== 'client').map((user: RecordMap) => <SelectItem key={user.id} value={user.id}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#64748B]">Junior closer</Label>
              <Select value={form.junior_closer_id || 'unassigned'} onValueChange={(value) => setForm({ ...form, junior_closer_id: value === 'unassigned' ? '' : value })}>
                <SelectTrigger data-testid="deal-junior-closer" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.filter((user: RecordMap) => user.role !== 'client').map((user: RecordMap) => <SelectItem key={user.id} value={user.id}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#64748B]">Senior closer</Label>
              <Select value={form.senior_closer_id || 'unassigned'} onValueChange={(value) => setForm({ ...form, senior_closer_id: value === 'unassigned' ? '' : value })}>
                <SelectTrigger data-testid="deal-senior-closer" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.filter((user: RecordMap) => user.role !== 'client').map((user: RecordMap) => <SelectItem key={user.id} value={user.id}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-[#64748B]">Notes</Label>
              <Textarea data-testid="deal-notes" value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-[96px] rounded-[7px]" />
            </div>
          </div>
          <DialogFooter><Button data-testid="save-deal" onClick={saveDeal} className="rounded-[7px] bg-[#0F2B5B]">Save deal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}


type ChecklistCategory = 'submission' | 'funding' | 'stipulation' | 'compliance';

type ChecklistItem = {
  id: string;
  requestId?: string;
  name: string;
  documentType: string;
  category: ChecklistCategory;
  status: string;
  required: boolean;
  document?: RecordMap;
  assignedUser?: RecordMap;
  dueDate?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
  virtual?: boolean;
};

const CHECKLIST_STATUS_FLOW = ['missing', 'requested', 'received', 'in_review', 'approved', 'rejected', 'waived'];
const SUBMISSION_REQUIRED_ITEMS = [
  { key: 'completed_application', name: 'Completed application', category: 'submission' as ChecklistCategory },
  { key: 'owner_name', name: 'Full owner name', category: 'submission' as ChecklistCategory },
  { key: 'cell_phone', name: 'Cell phone number', category: 'submission' as ChecklistCategory },
  { key: 'business_legal_name', name: 'Business legal name', category: 'submission' as ChecklistCategory },
  { key: 'requested_amount', name: 'Requested funding amount', category: 'submission' as ChecklistCategory },
  { key: 'ein', name: 'Full EIN on file', category: 'compliance' as ChecklistCategory },
  { key: 'ssn', name: 'Full SSN on file', category: 'compliance' as ChecklistCategory },
  { key: 'bank_statements', name: 'At least 3 recent bank statements', category: 'submission' as ChecklistCategory },
  { key: 'drivers_license', name: "Driver's license", category: 'submission' as ChecklistCategory },
  { key: 'voided_check', name: 'Voided check', category: 'submission' as ChecklistCategory },
  { key: 'business_verification', name: 'Ownership / business verification', category: 'compliance' as ChecklistCategory, conditional: 'entity' },
  { key: 'advance_statements', name: 'Existing funding / advance statements', category: 'submission' as ChecklistCategory, conditional: 'positions' },
];
const FUNDING_REQUIRED_ITEMS = [
  { key: 'approved_offer', name: 'Approved lender offer', category: 'funding' as ChecklistCategory },
  { key: 'accepted_offer', name: 'Accepted offer', category: 'funding' as ChecklistCategory },
  { key: 'signed_contract', name: 'Signed contract', category: 'funding' as ChecklistCategory },
  { key: 'final_bank_verification', name: 'Final bank verification', category: 'funding' as ChecklistCategory },
  { key: 'final_owner_id_verification', name: 'Final owner ID verification', category: 'funding' as ChecklistCategory },
  { key: 'stips_satisfied', name: 'Stips satisfied', category: 'stipulation' as ChecklistCategory },
  { key: 'payoff_letter', name: 'Payoff letters uploaded for existing positions', category: 'funding' as ChecklistCategory, conditional: 'positions' },
  { key: 'funding_amount_confirmed', name: 'Funding amount confirmed', category: 'funding' as ChecklistCategory },
  { key: 'payment_frequency_confirmed', name: 'Payment frequency confirmed', category: 'funding' as ChecklistCategory },
];

function sameDocType(docType: string, wanted: string) {
  const a = normalize(docType || '').replace(/s$/, '');
  const b = normalize(wanted || '').replace(/s$/, '');
  return a === b
    || (wanted === 'license_verification' && ['drivers_license', 'driver_license', 'owner_id_verification'].includes(docType))
    || (wanted === 'owner_id_verification' && ['drivers_license', 'driver_license', 'license_verification'].includes(docType))
    || (wanted === 'completed_application' && ['signed_application', 'application'].includes(docType));
}

function docStatusForReadiness(doc?: RecordMap) {
  if (!doc) return 'missing';
  if (doc.status === 'uploaded') return 'received';
  if (doc.status === 'needs_replacement') return 'rejected';
  return doc.status || 'received';
}

function hasSensitiveValue(value: unknown) {
  return typeof value === 'string' && value.trim().length >= 4;
}

function buildDealChecklist(deal: RecordMap, docs: RecordMap[], requests: RecordMap[], offers: RecordMap[], positions: RecordMap[], stips: RecordMap[], app?: RecordMap, owners: RecordMap[] = []) {
  const firstOwner = owners[0] || deal.owners?.[0] || {};
  const business = deal.businesses || {};
  const requestByType = new Map<string, RecordMap>();
  requests.forEach((request) => requestByType.set(request.document_type, request));
  const docsFor = (type: string) => docs.filter((doc) => sameDocType(doc.document_type, type));
  const bestDocFor = (type: string) => docsFor(type).find((doc) => ['approved', 'uploaded', 'in_review'].includes(doc.status)) || docsFor(type)[0];
  const approvedOffer = offers.find((row) => ['received', 'presented', 'accepted'].includes(row.status));
  const acceptedOffer = offers.find((row) => row.status === 'accepted');
  const openStips = stips.filter((stip) => !['approved', 'waived'].includes(stip.status));
  const submissionItems = SUBMISSION_REQUIRED_ITEMS.filter((item) => item.conditional !== 'positions' || positions.length > 0).filter((item) => item.conditional !== 'entity' || (business.entity_type && business.entity_type !== 'sole_proprietor')).map((item) => {
    let status = 'missing';
    let doc = bestDocFor(item.key);
    if (item.key === 'completed_application') status = app?.submitted_at || ['submitted', 'under_review', 'approved'].includes(app?.status) ? 'approved' : docStatusForReadiness(doc);
    else if (item.key === 'owner_name') status = [firstOwner.first_name, firstOwner.last_name, business.contact_name].filter(Boolean).length ? 'approved' : 'missing';
    else if (item.key === 'cell_phone') status = firstOwner.mobile_phone || firstOwner.phone || business.phone ? 'approved' : 'missing';
    else if (item.key === 'business_legal_name') status = business.legal_name ? 'approved' : 'missing';
    else if (item.key === 'requested_amount') status = deal.requested_amount || app?.requested_amount ? 'approved' : 'missing';
    else if (item.key === 'ein') status = hasSensitiveValue(business.ein_encrypted) || hasSensitiveValue(business.ein_last4) ? 'approved' : 'missing';
    else if (item.key === 'ssn') status = hasSensitiveValue(firstOwner.ssn_encrypted) || hasSensitiveValue(firstOwner.ssn_last4) ? 'approved' : 'missing';
    else if (item.key === 'bank_statements') status = docsFor('bank_statement').length >= 3 || docsFor('bank_statements').length >= 3 ? 'approved' : docStatusForReadiness(doc);
    else status = docStatusForReadiness(doc);
    const request = requestByType.get(item.key) || requestByType.get(item.key.replace('bank_statement', 'bank_statements'));
    return { id: request?.id || `required-${item.key}`, requestId: request?.id, name: request?.label || item.name, documentType: item.key, category: request?.category || item.category, status: request?.status === 'uploaded' ? 'received' : (request?.status || status), required: request?.required ?? true, document: doc, assignedUser: request?.assigned_user, dueDate: request?.due_date, notes: request?.notes || request?.description, updatedAt: request?.updated_at || doc?.updated_at || doc?.created_at, virtual: !request } as ChecklistItem;
  });
  const fundingItems = FUNDING_REQUIRED_ITEMS.filter((item) => item.conditional !== 'positions' || positions.length > 0).map((item) => {
    let status = 'missing';
    let doc = bestDocFor(item.key);
    if (item.key === 'approved_offer') status = approvedOffer ? 'approved' : 'missing';
    else if (item.key === 'accepted_offer') status = acceptedOffer ? 'approved' : 'missing';
    else if (item.key === 'stips_satisfied') status = openStips.length ? 'requested' : (stips.length ? 'approved' : 'missing');
    else if (item.key === 'funding_amount_confirmed') status = deal.funded_amount || acceptedOffer?.approved_amount || deal.approved_amount ? 'approved' : 'missing';
    else if (item.key === 'payment_frequency_confirmed') status = acceptedOffer?.payment_frequency || approvedOffer?.payment_frequency || app?.desired_payment_frequency ? 'approved' : 'missing';
    else status = docStatusForReadiness(doc);
    const request = requestByType.get(item.key);
    return { id: request?.id || `funding-${item.key}`, requestId: request?.id, name: request?.label || item.name, documentType: item.key, category: request?.category || item.category, status: request?.status === 'uploaded' ? 'received' : (request?.status || status), required: request?.required ?? true, document: doc, assignedUser: request?.assigned_user, dueDate: request?.due_date, notes: request?.notes || request?.description, updatedAt: request?.updated_at || doc?.updated_at || doc?.created_at, virtual: !request } as ChecklistItem;
  });
  const stipItems = stips.map((stip) => ({ id: `stip-${stip.id}`, name: stip.name, documentType: 'stipulation', category: 'stipulation' as ChecklistCategory, status: stip.status === 'needed' ? 'missing' : stip.status, required: true, document: docs.find((doc) => doc.id === stip.document_id), assignedUser: stip.assigned_user, dueDate: stip.due_date, notes: stip.notes || stip.required_by_partner, updatedAt: stip.updated_at }));
  return [...submissionItems, ...fundingItems, ...stipItems];
}

function calculateReadiness(items: ChecklistItem[], category: 'submission' | 'funding') {
  const relevant = items.filter((item) => category === 'submission' ? ['submission', 'compliance'].includes(item.category) : ['funding', 'stipulation'].includes(item.category));
  const required = relevant.filter((item) => item.required !== false);
  const approved = required.filter((item) => ['approved', 'waived'].includes(item.status));
  const received = required.filter((item) => ['received', 'uploaded'].includes(item.status));
  const inReview = required.filter((item) => item.status === 'in_review');
  const rejected = required.filter((item) => ['rejected', 'needs_replacement'].includes(item.status));
  const missing = required.filter((item) => ['missing', 'requested'].includes(item.status));
  const score = required.length ? Math.round(((approved.length + received.length * 0.75 + inReview.length * 0.5) / required.length) * 100) : 100;
  const status = category === 'submission' ? (score >= 90 && !rejected.length && !missing.length ? 'Ready to Submit' : score >= 65 ? 'Needs Review' : 'Not Ready') : (score >= 90 && !rejected.length && !missing.length ? 'Ready to Fund' : (inReview.length || received.length || rejected.length ? 'Stips Needed' : 'Not Ready'));
  return { score, status, missing, received, inReview, rejected, approved, required };
}

function getOfferInsights(offers: RecordMap[]) {
  if (!offers.length) return { recommended: null as RecordMap | null, highlights: [] as [string, string][] };
  const enriched = offers.map((offer) => {
    const net = Number(offer.net_funding_amount || offer.approved_amount || 0) - Number(offer.origination_fee || 0);
    const burden = Number(offer.daily_payment || offer.weekly_payment || 0);
    const factor = Number(offer.factor_rate || offer.sell_rate || 9);
    const stips = Array.isArray(offer.stips_required) ? offer.stips_required.length : 0;
    const daysToExpire = offer.expires_at ? Math.max(0, Math.ceil((new Date(offer.expires_at).getTime() - Date.now()) / 86400000)) : 14;
    const commission = net * (Number(offer.broker_commission_pct || 0) / 100);
    const score = net / 1000 - burden / 50 - factor * 25 - stips * 6 + Math.min(daysToExpire, 30) + commission / 2000;
    return { offer, net, burden, factor, commission, score };
  });
  const by = (fn: (row: typeof enriched[number]) => number, dir: 'max' | 'min' = 'max') => enriched.slice().sort((a, b) => dir === 'max' ? fn(b) - fn(a) : fn(a) - fn(b))[0];
  const recommended = by((row) => row.score).offer;
  return {
    recommended,
    highlights: [
      ['Highest funding amount', `${partnerName(by((row) => Number(row.offer.approved_amount || 0)).offer)} · ${currency(by((row) => Number(row.offer.approved_amount || 0)).offer.approved_amount)}`],
      ['Lowest factor rate', `${partnerName(by((row) => row.factor, 'min').offer)} · ${by((row) => row.factor, 'min').factor || 'N/A'}`],
      ['Lowest payment burden', `${partnerName(by((row) => row.burden, 'min').offer)} · ${currency(by((row) => row.burden, 'min').burden)}`],
      ['Best estimated commission', `${partnerName(by((row) => row.commission).offer)} · ${currency(by((row) => row.commission).commission)}`],
      ['Best overall recommendation', partnerName(recommended)],
    ] as [string, string][],
  };
}

export function CrmDealDetailExperience({ dealId }: { dealId: string }) {
  const { deals, offers, partners, isoBrokers, documents, activities, notes, partnerSubmissions, renewals, commissions, commissionRecipients, riskEvents, currentPositions, dealFinancials, documentRequests, tasks, stipulations, applications, owners, users, organizationId, profile, loading, reload } = useCrmDataset();
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingSubmission, setSavingSubmission] = useState(false);
  const [analyzingStatements, setAnalyzingStatements] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('bank_statement');
  const [documentDescription, setDocumentDescription] = useState('');
  const [documentFilter, setDocumentFilter] = useState('all');
  const [noteBody, setNoteBody] = useState('');
  const [noteInternal, setNoteInternal] = useState(true);
  const [submissionPartnerIds, setSubmissionPartnerIds] = useState<string[]>([]);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionInternalNotes, setSubmissionInternalNotes] = useState('');
  const [submissionDocumentIds, setSubmissionDocumentIds] = useState<string[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({});
  const [commissionForm, setCommissionForm] = useState<RecordMap>({ recipient_name: '', recipient_type: 'referral_partner', percentage: '20', flat_amount: '', notes: '', payout_status: 'pending' });
  const [riskForm, setRiskForm] = useState<RecordMap>({ event_type: 'defaulted', funding_partner_id: '', amount: '', notes: '' });
  if (loading) return <LoadingScreen title="Deal Detail" />;
  const deal = deals.find((row: RecordMap) => row.id === dealId) || deals[0];
  if (!deal) return <PageFrame title="Deal Detail" subtitle="No deal selected"><EmptyState title="Deal not found" body="The requested deal could not be loaded." /></PageFrame>;
  const app = applications.find((row: RecordMap) => row.id === deal.application_id || row.business_id === deal.business_id);
  const dealOffers = offers.filter((offer: RecordMap) => offer.deal_id === deal.id);
  const dealCommissions = commissions.filter((row: RecordMap) => row.deal_id === deal.id);
  const dealCommissionRecipients = commissionRecipients.filter((row: RecordMap) => row.deal_id === deal.id);
  const dealRiskEvents = riskEvents.filter((row: RecordMap) => row.deal_id === deal.id || row.business_id === deal.business_id);
  const repeatDeals = deals.filter((row: RecordMap) => row.id !== deal.id && (row.business_id === deal.business_id || row.duplicate_of_business_id === deal.business_id || row.business_id === deal.duplicate_of_business_id));
  const dealDocs = documents.filter((doc: RecordMap) => doc.deal_id === deal.id || doc.application_id === deal.application_id);
  const signedApplicationDoc = dealDocs.find((doc: RecordMap) => doc.id === app?.signed_application_document_id)
    || dealDocs.find((doc: RecordMap) => sameDocType(doc.document_type, 'completed_application'))
    || dealDocs.find((doc: RecordMap) => sameDocType(doc.document_type, 'signed_application'));
  const dealRequests = documentRequests.filter((request: RecordMap) => request.deal_id === deal.id || request.application_id === deal.application_id);
  const dealStips = stipulations.filter((stip: RecordMap) => stip.deal_id === deal.id || dealOffers.some((offer: RecordMap) => offer.id === stip.offer_id));
  const dealTasks = tasks.filter((task: RecordMap) => task.deal_id === deal.id || task.application_id === deal.application_id).sort((a: RecordMap, b: RecordMap) => new Date(a.due_date || '2999-01-01').getTime() - new Date(b.due_date || '2999-01-01').getTime());
  const businessOwners = owners.filter((owner: RecordMap) => owner.business_id === deal.business_id || owner.id === deal.owner_id);
  const dealRenewals = renewals.filter((renewal: RecordMap) => renewal.original_deal_id === deal.id);
  const financial = dealFinancials.find((row: RecordMap) => row.deal_id === deal.id) || {};
  const positions = currentPositions.filter((row: RecordMap) => row.deal_id === deal.id || row.business_id === deal.business_id);
  const offer = dealOffers[0] || {};
  const intelligence = getDealScore(deal, dealDocs, positions);
  const complianceBlocks = getComplianceBlocks(deal, dealDocs);
  const disclosureState = getDisclosureState(deal.businesses);
  const activePositions = positions.filter((row: RecordMap) => String(row.status || 'active').toLowerCase() === 'active');
  const positionCount = activePositions.length;
  const partnerMatches = getPartnerMatches(deal, partners, dealDocs, positions).filter((match) => lenderAcceptsPositionCount(match.partner, positionCount) && lenderAcceptsFinancials(match.partner, financial)).slice(0, 8);
  const currentBalance = dealRenewals[0]?.current_balance || financial.current_balance || Math.max(Number(offer.payback_amount || deal.funded_amount || 0) - Number(deal.funded_amount || 0) * 0.45, 0);
  const percentPaid = dealRenewals[0]?.percent_paid_down || financial.percent_paid_down || (deal.stage_slug === 'funded' ? 55 : 0);
  const dealNotes = notes.filter((row: RecordMap) => row.deal_id === deal.id || row.application_id === deal.application_id);
  const internalNotes = dealNotes.filter((row: RecordMap) => row.is_internal !== false).slice(0, 6);
  const dealSubmissions = partnerSubmissions.filter((row: RecordMap) => row.deal_id === deal.id);
  const historyDeals = [deal, ...repeatDeals].sort((a: RecordMap, b: RecordMap) => Number(a.submission_sequence || 0) - Number(b.submission_sequence || 0) || new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const selectedSubmissionPartners = partners.filter((row: RecordMap) => submissionPartnerIds.includes(row.id));
  const selectedPartnerDefaultEvents = riskEvents.filter((row: RecordMap) => row.business_id === deal.business_id && submissionPartnerIds.includes(row.funding_partner_id) && row.event_type === 'defaulted');
  const canSendToLenders = ['super_admin', 'admin', 'sales_rep'].includes(profile?.role || '');
  const canAssignDeal = ['super_admin', 'admin'].includes(profile?.role || '');
  const canViewFinance = ['super_admin', 'admin'].includes(profile?.role || '');
  const assignableUsers = users.filter((row: RecordMap) => row.is_active !== false && !row.deleted_at && row.role !== 'client');
  const repNameById = (id?: string | null) => repName({ user_profiles: users.find((row: RecordMap) => row.id === id) });
  const checklist = buildDealChecklist(deal, dealDocs, dealRequests, dealOffers, positions, dealStips, app, businessOwners);
  const submissionReadiness = calculateReadiness(checklist, 'submission');
  const fundingReadiness = calculateReadiness(checklist, 'funding');
  const offerInsights = getOfferInsights(dealOffers);
  const canWaive = ['super_admin', 'admin', 'manager', 'underwriter'].includes(profile?.role || '');
  const canMarkFunded = ['super_admin', 'admin', 'manager'].includes(profile?.role || '');
  const filteredDocs = documentFilter === 'all' ? dealDocs : dealDocs.filter((doc: RecordMap) => doc.status === documentFilter || doc.document_type === documentFilter);
  const publicRecords = publicRecordStatus(dealRiskEvents);
  const analysisRows: [string, React.ReactNode][] = [
    ['Total deposits', currency(analysisMetric(financial, deal, ['total_deposits', 'gross_deposits', 'monthly_deposits', 'avg_monthly_deposits']))],
    ['Total withdrawals', currency(analysisMetric(financial, deal, ['total_withdrawals', 'gross_withdrawals', 'monthly_withdrawals']))],
    ['Net cash flow', currency(analysisMetric(financial, deal, ['net_cash_flow', 'net_cashflow'], Number(analysisMetric(financial, deal, ['total_deposits'], 0)) - Number(analysisMetric(financial, deal, ['total_withdrawals'], 0))))],
    ['Average daily ledger balance', currency(analysisMetric(financial, deal, ['average_daily_ledger_balance', 'avg_daily_ledger_balance', 'average_daily_balance']))],
    ['Negative balance days/mo', analysisMetric(financial, deal, ['negative_balance_days_per_month', 'negative_days_count', 'negative_days'], 0)],
    ['NSF count', analysisMetric(financial, deal, ['nsf_count', 'nsfs'], 0)],
  ];
  const missingDocItems = checklist.filter((item) => ['missing', 'requested', 'rejected', 'needs_replacement'].includes(item.status) && ['submission', 'compliance', 'funding'].includes(item.category));
  const groupedDocs = DETAIL_DOCUMENT_TYPES.map((type) => ({ type, docs: filteredDocs.filter((doc: RecordMap) => sameDocType(doc.document_type, type.value)) })).filter((group) => group.docs.length);
  const noteEvents = dealNotes.map((row: RecordMap) => ({ id: `note-${row.id}`, created_at: row.created_at, title: row.is_internal ? 'Internal note added' : 'Shared note added', body: row.body || row.note, activity_type: 'note' }));
  const documentEvents = dealDocs.map((row: RecordMap) => ({ id: `document-${row.id}`, created_at: row.updated_at || row.created_at, title: `Document ${row.status || 'uploaded'}: ${row.label || row.file_name}`, body: row.review_notes || row.file_name, activity_type: 'document_event' }));
  const lenderEvents = dealSubmissions.map((row: RecordMap) => ({ id: `submission-${row.id}`, created_at: row.updated_at || row.created_at, title: `Lender ${row.status}: ${partnerName(row)}`, body: row.notes || row.decline_reason, activity_type: 'partner_submission' }));
  const taskEvents = dealTasks.map((row: RecordMap) => ({ id: `task-${row.id}`, created_at: row.updated_at || row.created_at, title: `Task ${row.status}: ${row.title}`, body: row.description, activity_type: 'task' }));
  const dealActivity = [...activities.filter((row: RecordMap) => row.deal_id === deal.id || row.resource_id === deal.id || row.application_id === deal.application_id), ...noteEvents, ...documentEvents, ...lenderEvents, ...taskEvents].sort((a: RecordMap, b: RecordMap) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 60);
  const openTasks = dealTasks.filter((task: RecordMap) => task.status !== 'completed');
  const overdueTasks = openTasks.filter((task: RecordMap) => task.due_date && new Date(task.due_date).getTime() < Date.now());
  const nextAction = submissionReadiness.score < 90 ? `Request ${submissionReadiness.missing[0]?.name || 'missing documents'}` : dealSubmissions.length === 0 ? 'Submit to lenders' : dealOffers.length === 0 ? `Follow up with ${partnerName(dealSubmissions[0])}` : !dealOffers.some((row: RecordMap) => row.status === 'accepted') ? 'Present offer to merchant' : fundingReadiness.score < 90 ? `Collect ${fundingReadiness.missing[0]?.name || 'remaining funding stips'}` : deal.stage_slug !== 'funded' ? 'Mark deal funded' : 'Monitor renewal eligibility';

  const logActivity = async (activity_type: string, title: string, body?: string | null) => {
    console.debug('Activity logging is handled by server APIs.', { activity_type, title, body });
  };

  const resetDocumentDialog = () => { setDocumentFile(null); setDocumentDescription(''); setDocumentType('bank_statement'); };

  const uploadDealDocument = async () => {
    if (!documentFile) { toast.error('Please select a document.'); return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    const extension = documentFile.name.split('.').pop()?.toLowerCase();
    if (documentFile.size > 10 * 1024 * 1024 || (!allowed.includes(documentFile.type) && !['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif'].includes(extension || ''))) { toast.error('Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.'); return; }
    setUploadingDocument(true);
    try {
      const linkedRequest = dealRequests.find((request: RecordMap) => sameDocType(documentType, request.document_type) || sameDocType(request.document_type, documentType));
      const label = detailDocTypeLabel(documentType);
      const formData = new FormData();
      formData.set('file', documentFile);
      formData.set('document_type', documentType);
      formData.set('label', label);
      formData.set('review_notes', documentDescription);
      if (linkedRequest?.id) formData.set('document_request_id', linkedRequest.id);
      const response = await fetch(`/api/crm/deals/${deal.id}/documents`, { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to upload document');
      toast.success(result.generatedEliteApplication?.generated ? 'Document uploaded and Elite application generated' : 'Deal document uploaded');
      setDocumentDialogOpen(false); resetDocumentDialog(); reload();
    } catch (error: any) { toast.error(error.message || 'Failed to upload document'); } finally { setUploadingDocument(false); }
  };

  const updateDocumentStatus = async (doc: RecordMap, status: string, reason?: string) => {
    const response = await fetch(`/api/documents/${doc.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, review_notes: reason || doc.review_notes || null }) });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to update document'); return; }
    await logActivity('document_event', `Document status changed: ${doc.label || doc.file_name}`, `${doc.status || 'uploaded'} → ${status}${reason ? ` · ${reason}` : ''}`);
    toast.success('Document updated'); reload();
  };

  const updateChecklistItem = async (item: ChecklistItem, status: string) => {
    if (status === 'waived' && !canWaive) { toast.error('Only managers, admins, and underwriters can waive checklist items.'); return; }
    const notesValue = checklistNotes[item.id] ?? item.notes ?? null;
    const response = await fetch(`/api/crm/deals/${deal.id}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: item.requestId || null, application_id: deal.application_id || null, document_type: item.documentType, label: item.name, required: item.required, status, category: item.category, notes: notesValue, assigned_user_id: item.assignedUser?.id || deal.assigned_user_id || null }) });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to update checklist'); return; }
    await logActivity('document_event', `Checklist item ${status}: ${item.name}`, notesValue);
    toast.success('Checklist updated'); reload();
  };

  const saveDealNote = async () => {
    if (!noteBody.trim()) { toast.error('Enter a note before saving.'); return; }
    setSavingNote(true);
    try {
      const body = noteBody.trim();
      const response = await fetch(`/api/crm/deals/${deal.id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, is_internal: noteInternal }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to save note');
      await logActivity('note', noteInternal ? 'Internal note added' : 'Shared note added', body);
      toast.success('Note added'); setNoteDialogOpen(false); setNoteBody(''); setNoteInternal(true); reload();
    } catch (error: any) { toast.error(error.message || 'Failed to save note'); } finally { setSavingNote(false); }
  };

  const runBankStatementAnalysis = async (showSuccess = true) => {
    setAnalyzingStatements(true);
    try {
      const response = await fetch(`/api/crm/deals/${deal.id}/analyze-bank-statements`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to analyze bank statements');
      if (showSuccess) toast.success(`AI analysis complete: ${result.analysis?.position_count || 0} position(s) detected`);
      reload();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Unable to analyze bank statements');
      return false;
    } finally {
      setAnalyzingStatements(false);
    }
  };

  const submitToLender = async () => {
    if (!canSendToLenders) { toast.error('Only admins and sales reps can send deals to lenders.'); return; }
    const fundingPartnerIds = submissionPartnerIds;
    if (!fundingPartnerIds.length) { toast.error('Choose at least one lender to send this deal to.'); return; }
    if (!submissionNotes.trim()) { toast.error('Add a lender message before sending.'); return; }
    setSavingSubmission(true);
    try {
      const bankDocs = dealDocs.filter((doc: RecordMap) => sameDocType(doc.document_type, 'bank_statement') || sameDocType(doc.document_type, 'bank_statements'));
      if (bankDocs.length && financial.analysis_status !== 'completed') {
        const analyzed = await runBankStatementAnalysis(false);
        if (!analyzed) toast.warning('AI analysis did not complete before submission. The lender submission will still be logged.');
      }
      for (const fundingPartnerId of fundingPartnerIds) {
        const response = await fetch(`/api/crm/deals/${deal.id}/lender-submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ funding_partner_id: fundingPartnerId, custom_message: submissionNotes, internal_note: submissionInternalNotes, attachment_document_ids: submissionDocumentIds }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || `Failed to submit deal to ${partners.find((row: RecordMap) => row.id === fundingPartnerId)?.name || 'lender'}`);
        if (result.warnings?.length) result.warnings.forEach((warning: string) => toast.warning(warning));
      }
      toast.success(fundingPartnerIds.length === 1 ? 'Lender email sent' : `Lender emails sent to ${fundingPartnerIds.length} lenders`);
      setSubmissionDialogOpen(false); setSubmissionPartnerIds([]); setSubmissionNotes(''); setSubmissionInternalNotes(''); setSubmissionDocumentIds([]); reload();
    } catch (error: any) { toast.error(error.message || 'Failed to submit deal to lender'); } finally { setSavingSubmission(false); }
  };

  const updateSubmission = async (submission: RecordMap, updates: RecordMap) => {
    const response = await fetch(`/api/crm/partner-submissions/${submission.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to update lender submission'); return; }
    await logActivity('partner_submission', `Lender status changed: ${partnerName(submission)}`, updates.status ? `${submission.status} → ${updates.status}` : updates.notes || updates.decline_reason || 'Submission updated');
    toast.success('Lender submission updated'); reload();
  };

  const convertSubmissionToOffer = async (submission: RecordMap) => {
    const response = await fetch(`/api/crm/partner-submissions/${submission.id}/offer`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to create offer'); return; }
    toast.success('Offer created'); reload();
  };

  const createTask = async () => {
    if (!taskTitle.trim()) { toast.error('Enter a task title.'); return; }
    const response = await fetch(`/api/crm/deals/${deal.id}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: taskTitle.trim(), due_date: taskDueDate || null, priority: taskPriority }) });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to create task'); return; }
    await logActivity('task', `Task created: ${taskTitle.trim()}`, taskDueDate ? `Due ${date(taskDueDate)}` : null);
    setTaskTitle(''); setTaskDueDate(''); setTaskPriority('medium'); toast.success('Task created'); reload();
  };

  const saveCommissionRecipient = async () => {
    if (!commissionForm.recipient_name?.trim()) { toast.error('Recipient name is required.'); return; }
    const response = await fetch(`/api/crm/deals/${deal.id}/commissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_name: commissionForm.recipient_name,
        recipient_type: commissionForm.recipient_type,
        percentage: commissionForm.percentage || 0,
        flat_amount: commissionForm.flat_amount || null,
        notes: commissionForm.notes || '',
        payout_status: commissionForm.payout_status || 'pending',
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to save commission recipient'); return; }
    toast.success('Commission recipient added');
    setCommissionForm({ recipient_name: '', recipient_type: 'referral_partner', percentage: '20', flat_amount: '', notes: '', payout_status: 'pending' });
    reload();
  };

  const saveRiskEvent = async () => {
    if (!riskForm.notes?.trim()) { toast.error('Add a note for the risk event.'); return; }
    const response = await fetch(`/api/crm/deals/${deal.id}/risk-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: riskForm.event_type, funding_partner_id: riskForm.funding_partner_id || null, amount: riskForm.amount || null, notes: riskForm.notes }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to record risk event'); return; }
    toast.success('Risk event recorded');
    setRiskForm({ event_type: 'defaulted', funding_partner_id: '', amount: '', notes: '' });
    reload();
  };

  const completeTask = async (task: RecordMap) => {
    const response = await fetch(`/api/crm/tasks/${task.id}/complete`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to complete task'); return; }
    toast.success('Task completed'); reload();
  };

  const openDealDocument = async (doc: RecordMap, disposition: 'preview' | 'download') => {
    const response = await fetch(`/api/documents/${doc.id}/signed-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disposition }) });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to open document'); return; }
    window.open(result.url, '_blank', 'noopener,noreferrer');
  };

  const updateStage = async (stage_slug: string) => {
    if (stage_slug === 'funded' && (!canMarkFunded || complianceBlocks.length > 0 || fundingReadiness.score < 90)) { toast.error(canMarkFunded ? `Funding blocked: ${complianceBlocks[0] || 'readiness is incomplete'}` : 'Only managers and admins can mark deals funded.'); return; }
    const response = await fetch(`/api/crm/deals/${deal.id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_slug, notes: `Deal detail stage update: ${stageLabel(deal.stage_slug)} -> ${stageLabel(stage_slug)}` }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to update deal stage');
    else { toast.success('Deal stage updated'); reload(); }
  };

  const updateDealBroker = async (iso_broker_id: string) => {
    const response = await fetch(`/api/crm/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iso_broker_id: iso_broker_id === 'none' ? null : iso_broker_id }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      toast.error(result.error || 'Unable to update broker assignment');
      return;
    }
    toast.success(iso_broker_id === 'none' ? 'Broker removed from deal' : 'Broker assigned to deal');
    reload();
  };

  const updateDealAssignment = async (field: 'assigned_user_id' | 'junior_closer_id' | 'senior_closer_id', value: string) => {
    if (!canAssignDeal) {
      toast.error('Only admins can change deal rep assignments.');
      return;
    }
    const response = await fetch(`/api/crm/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value === 'unassigned' ? null : value }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      toast.error(result.error || 'Unable to update deal assignment');
      return;
    }
    toast.success('Deal assignment updated');
    reload();
  };

  const requestUpdatedSignature = async () => {
    if (!app?.id) { toast.error('No application is linked to this deal.'); return; }
    const response = await fetch(`/api/crm/applications/${app.id}/signature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature_status: 'requires_resign', reason: 'Internal user requested updated application signature from deal detail.' }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to request updated signature'); return; }
    toast.success('Application marked as requiring a new signature');
    reload();
  };

  const ReadinessCard = ({ title, readiness, tone }: { title: string; readiness: ReturnType<typeof calculateReadiness>; tone: string }) => (
    <CrmCard className="p-4" data-testid={title === 'Submission readiness' ? 'submission-readiness-score' : 'funding-readiness-score'}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-[12px] font-semibold uppercase text-[#64748B]">{title}</p><p className="mt-1 text-3xl font-semibold text-[#0F172A]">{readiness.score}%</p></div><StatusBadge value={readiness.status} /></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E2E8F0]"><div className="h-full rounded-full" style={{ width: `${readiness.score}%`, background: tone }} /></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#64748B]"><span>Missing: <b className="text-[#DC2626]">{readiness.missing.length}</b></span><span>Received: <b>{readiness.received.length}</b></span><span>In review: <b>{readiness.inReview.length}</b></span><span>Rejected: <b>{readiness.rejected.length}</b></span></div>
    </CrmCard>
  );

  const ChecklistTable = ({ rows }: { rows: ChecklistItem[] }) => (
    <div className="overflow-x-auto rounded-[8px] border border-[#E2E8F0]" data-testid="missing-document-checklist">
      <table className="min-w-[980px] w-full text-sm"><thead className="bg-[#F8FAFC] text-left text-xs uppercase text-[#64748B]"><tr>{['Item','Status','Category','Related document','Owner','Due','Notes','Actions'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0] bg-white">{rows.map((item) => <tr key={item.id}><td className="px-3 py-2 font-semibold text-[#0F172A]">{item.name}</td><td className="px-3 py-2"><StatusBadge value={item.status} /></td><td className="px-3 py-2 capitalize">{item.category}</td><td className="px-3 py-2">{item.document ? <button className="font-semibold text-[#0F2B5B]" onClick={() => openDealDocument(item.document!, 'preview')}>{item.document.label || item.document.file_name}</button> : 'Not linked'}</td><td className="px-3 py-2">{item.assignedUser ? repName({ user_profiles: item.assignedUser }) : repName(deal)}</td><td className="px-3 py-2">{date(item.dueDate)}</td><td className="px-3 py-2"><Input value={checklistNotes[item.id] ?? item.notes ?? ''} onChange={(event) => setChecklistNotes({ ...checklistNotes, [item.id]: event.target.value })} placeholder="Add note" className="h-8 min-w-[160px] rounded-[7px]" /></td><td className="px-3 py-2"><div className="flex flex-wrap gap-1">{CHECKLIST_STATUS_FLOW.filter((status) => status !== 'missing' && (status !== 'waived' || canWaive)).map((status) => <Button key={status} size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => updateChecklistItem(item, status)}>{status.replaceAll('_',' ')}</Button>)}</div></td></tr>)}</tbody></table>
    </div>
  );

  return (
    <PageFrame title={businessName(deal)} subtitle={`Deal ${shortId(deal.id)} - ${stageLabel(deal.stage_slug)}`} actions={<Link href="/crm/deals" className="crm-focus-ring rounded-[8px] px-3 py-2 text-sm font-bold text-[#0F2B5B] hover:bg-[#EEF2F7]">Back to deals</Link>}>
      <CrmCard className="mb-4 overflow-hidden">
        <div className="grid gap-4 bg-[#081523] p-5 text-white lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#D9B95D]">Deal command center</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-white">{businessName(deal)}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#CBD5E1]">{dealSummary(deal, app, businessOwners)}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[12px] border border-white/10 bg-white/[0.06] p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Stage</p>
              <div className="mt-2"><StatusBadge value={deal.stage_slug} /></div>
            </div>
            <div className="rounded-[12px] border border-white/10 bg-white/[0.06] p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#94A3B8]">Next action</p>
              <p className="mt-2 text-sm font-bold text-white">{nextAction}</p>
            </div>
          </div>
        </div>
      </CrmCard>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard title="Requested" value={currency(deal.requested_amount)} subtitle="Merchant ask" icon={<Target className="h-4 w-4" />} />
        <MetricCard title="Submission Ready" value={`${submissionReadiness.score}%`} subtitle={submissionReadiness.status} icon={<ClipboardList className="h-4 w-4" />} tone={submissionReadiness.score >= 90 ? '#059669' : submissionReadiness.score >= 65 ? '#D97706' : '#DC2626'} />
        <MetricCard title="Lenders / Offers" value={`${dealSubmissions.length} / ${dealOffers.length}`} subtitle="Submissions and responses" icon={<Building2 className="h-4 w-4" />} tone="#2563EB" />
        <MetricCard title="Next Best Action" value={nextAction} subtitle={overdueTasks.length ? `${overdueTasks.length} overdue task(s)` : 'Current operational priority'} icon={<Sparkles className="h-4 w-4" />} tone="#C9A84C" />
      </div>
      <div className="mb-4 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
        <CrmCard className="p-4"><p className="text-[11px] font-semibold uppercase text-[#64748B]">Next best action</p><h2 className="mt-2 text-xl font-semibold text-[#0F172A]">{nextAction}</h2><p className="mt-2 text-sm text-[#64748B]">Critical missing items: {missingDocItems.slice(0, 4).map((item) => item.name).join(', ') || 'None'}.</p></CrmCard>
        <CrmCard className="p-4"><InfoGrid rows={[["Current stage", stageLabel(deal.stage_slug)], ["Primary rep", repNameById(deal.assigned_user_id)], ["Junior rep", repNameById(deal.junior_closer_id)], ["Senior rep", repNameById(deal.senior_closer_id)], ["Broker / ISO", isoBrokerName(deal.iso_brokers)], ["Recent activity", date(dealActivity[0]?.created_at)], ["Open tasks", openTasks.length]]} /></CrmCard>
      </div>
      <CrmCard className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><p className="text-[11px] font-semibold uppercase text-[#64748B]">Internal Notes</p><h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Latest team context</h2></div>
          <Button size="sm" variant="outline" className="h-8 rounded-[7px]" onClick={() => { setNoteInternal(true); setNoteDialogOpen(true); }}><Plus className="mr-1 h-3 w-3" />Add note</Button>
        </div>
        <SimpleRows rows={internalNotes} empty="No internal notes yet." render={(row) => <div><b>Internal note</b><p className="text-[#334155]">{row.body || row.note}</p><p className="text-xs text-[#64748B]">{date(row.created_at)}</p></div>} />
      </CrmCard>
      <CrmCard className="p-4">
        <div className="mb-4 grid gap-3 border-b border-[#E2E8F0] pb-4 xl:grid-cols-[0.7fr_1.3fr]">
          <div><p className="text-[11px] font-semibold uppercase text-[#64748B]">Deal controls</p><p className="text-sm font-semibold text-[#0F172A]">{stageLabel(deal.stage_slug)}</p><p className="mt-1 text-xs text-[#64748B]">Rep assignment is admin-only.</p></div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <div><Label className="text-[11px] text-[#64748B]">Stage</Label><Select value={deal.stage_slug || 'lead_captured'} onValueChange={updateStage}><SelectTrigger data-testid="deal-detail-stage" className="mt-1 h-10 w-full rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent>{STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-[11px] text-[#64748B]">Broker / ISO</Label><Select value={deal.iso_broker_id || 'none'} onValueChange={updateDealBroker}><SelectTrigger data-testid="deal-detail-iso-broker" className="mt-1 h-10 w-full rounded-[7px]"><SelectValue placeholder="Assign broker" /></SelectTrigger><SelectContent><SelectItem value="none">No broker</SelectItem>{isoBrokers.map((broker: RecordMap) => <SelectItem key={broker.id} value={broker.id}>{isoBrokerName(broker)}</SelectItem>)}</SelectContent></Select></div>
            {canAssignDeal ? <><div><Label className="text-[11px] text-[#64748B]">Primary rep</Label><Select value={deal.assigned_user_id || 'unassigned'} onValueChange={(value) => updateDealAssignment('assigned_user_id', value)}><SelectTrigger data-testid="deal-detail-primary-rep" className="mt-1 h-10 w-full rounded-[7px]"><SelectValue placeholder="Assign rep" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{assignableUsers.map((user: RecordMap) => <SelectItem key={user.id} value={user.id}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-[11px] text-[#64748B]">Junior rep</Label><Select value={deal.junior_closer_id || 'unassigned'} onValueChange={(value) => updateDealAssignment('junior_closer_id', value)}><SelectTrigger data-testid="deal-detail-junior-rep" className="mt-1 h-10 w-full rounded-[7px]"><SelectValue placeholder="Assign junior rep" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{assignableUsers.map((user: RecordMap) => <SelectItem key={user.id} value={user.id}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-[11px] text-[#64748B]">Senior rep</Label><Select value={deal.senior_closer_id || 'unassigned'} onValueChange={(value) => updateDealAssignment('senior_closer_id', value)}><SelectTrigger data-testid="deal-detail-senior-rep" className="mt-1 h-10 w-full rounded-[7px]"><SelectValue placeholder="Assign senior rep" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{assignableUsers.map((user: RecordMap) => <SelectItem key={user.id} value={user.id}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</SelectItem>)}</SelectContent></Select></div></> : <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#64748B] md:col-span-2 xl:col-span-3">Primary rep: {repNameById(deal.assigned_user_id)}. Junior rep: {repNameById(deal.junior_closer_id)}. Senior rep: {repNameById(deal.senior_closer_id)}.</div>}
          </div>
        </div>
        <Tabs defaultValue="overview"><TabsList className="mb-4 flex h-auto flex-wrap justify-start rounded-[8px] bg-[#F1F5F9] p-1">{[['overview','Overview'],['readiness','Readiness'],['documents','Documents'],['notes','Notes'],['lenders','Lenders Sent To'],['offers','Offers'], ...(canViewFinance ? [['finance','Finance']] : []), ['history','History'],['tasks','Tasks'],['activity','Activity']].map(([value, label]) => <TabsTrigger key={value} value={value} className="rounded-[6px]">{label}</TabsTrigger>)}</TabsList>
          <TabsContent value="overview"><div className="grid gap-4 lg:grid-cols-2">{repeatDeals.length > 0 && <div className="lg:col-span-2 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><b>Repeat merchant:</b> {repeatDeals.length} prior submission(s) found. Current version: #{deal.submission_sequence || repeatDeals.length + 1}. {dealRiskEvents.some((event: RecordMap) => event.event_type === 'defaulted') ? 'Prior default history exists.' : ''}</div>}<CrmCard className="lg:col-span-2 p-4"><div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-[11px] font-semibold uppercase text-[#64748B]">Signed Application</p><h2 className="mt-1 text-lg font-semibold text-[#0F172A]">{app?.signature_status === 'signed' ? 'Website application signed' : app?.signature_status === 'requires_resign' ? 'Updated signature required' : 'Application not signed'}</h2><p className="mt-1 text-sm text-[#64748B]">Version {app?.application_version || 1} · {app?.consent_version || 'No consent version recorded'}</p></div><StatusBadge value={app?.signature_status || 'unsigned'} /></div><InfoGrid rows={[["Signed applicant name", app?.signed_name || app?.application_payload?.signature || 'Not signed'], ["Signed date/time", date(app?.signed_at || app?.submitted_at)], ["Signature type", app?.signature_type || (app?.signed_name ? 'typed' : 'N/A')], ["Disclosure acceptance", app?.esign_consent_accepted && app?.credit_authorization_accepted && app?.terms_accepted ? 'Accepted' : 'Incomplete'], ["Signer IP", app?.signer_ip || app?.ip_address || 'Not captured'], ["Browser", app?.signer_user_agent || app?.user_agent ? 'Captured' : 'Not captured']]} /><div className="mt-4 flex flex-wrap gap-2">{signedApplicationDoc ? <><Button size="sm" variant="outline" className="h-8 rounded-[7px]" onClick={() => openDealDocument(signedApplicationDoc, 'preview')}><Eye className="mr-1 h-3 w-3" />View signed PDF</Button><Button size="sm" variant="outline" className="h-8 rounded-[7px]" onClick={() => openDealDocument(signedApplicationDoc, 'download')}><Download className="mr-1 h-3 w-3" />Download PDF</Button></> : <span className="rounded-[7px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Signed PDF has not been generated yet.</span>}<Button size="sm" variant="outline" className="h-8 rounded-[7px]" onClick={requestUpdatedSignature} disabled={!app?.id || app?.signature_status !== 'signed'}>Request updated signature</Button></div></CrmCard><CrmCard className="p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase text-[#64748B]">Full details</p><h2 className="mt-1 text-lg font-semibold text-[#0F172A]">{businessName(deal)}</h2></div><StatusBadge value={deal.stage_slug} /></div><InfoGrid rows={[["Requested funding amount", currency(deal.requested_amount || app?.requested_amount)], ["Application start date", date(app?.created_at || deal.created_at)], ["Time in business", formatTimeInBusiness(deal.businesses?.start_date || app?.business_start_date)], ["Legal name", deal.businesses?.legal_name || businessName(deal)], ["Phone", deal.businesses?.phone || 'Unknown'], ["Email", deal.businesses?.email || 'Unknown'], ["Monthly revenue", currency(deal.businesses?.monthly_gross_revenue)], ["Compliance gate", complianceBlocks.length ? complianceBlocks.join(' ') : 'Clear']]} /><div className="mt-4 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3"><p className="text-[11px] font-semibold uppercase text-[#64748B]">Client summary</p><p className="mt-2 text-sm leading-6 text-[#334155]">{dealSummary(deal, app, businessOwners)}</p></div></CrmCard><CrmCard className="p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase text-[#64748B]">Public Record & Court Check</p><h2 className="mt-1 text-lg font-semibold text-[#0F172A]">{publicRecords.label}</h2></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${publicRecords.tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{publicRecords.label}</span></div>{publicRecords.events.length ? <SimpleRows rows={publicRecords.events} empty="No public record events." render={(row) => <div><b>{String(row.event_type || 'record').replaceAll('_', ' ')}</b><p className="text-[#334155]">{row.notes || row.description || 'Review needed'}</p><p className="text-xs text-[#64748B]">{date(row.created_at)}{row.amount ? ` - ${currency(row.amount)}` : ''}</p></div>} /> : <p className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">No outstanding judgments, liens, court records, or defaults are on file.</p>}<div className="mt-4 grid gap-3"><ReadinessCard title="Submission readiness" readiness={submissionReadiness} tone="#0F2B5B" /><ReadinessCard title="Funding readiness" readiness={fundingReadiness} tone="#059669" /></div></CrmCard><CrmCard className="lg:col-span-2 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase text-[#64748B]">AI Submissions Analysis</p><h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Bank statement and position readout</h2></div><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" className="h-8 rounded-[7px]" onClick={() => runBankStatementAnalysis(true)} disabled={analyzingStatements}>{analyzingStatements ? 'Analyzing...' : 'Run AI Analysis'}</Button><span className="rounded-full bg-[#0F2B5B] px-3 py-1 text-sm font-semibold text-white">{positionCount} Positions</span></div></div><InfoGrid rows={analysisRows} />{activePositions.length ? <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{activePositions.map((position: RecordMap) => <div key={position.id} className="rounded-[8px] border border-[#E2E8F0] bg-white p-3 text-sm"><b>{position.funder_name || position.lender_name || position.funding_partner_name || position.name || 'Active position'}</b><p className="mt-1 text-[#334155]">{currency(position.payment_amount || position.daily_payment || position.weekly_payment)} {position.payment_frequency || position.frequency || 'payment'}</p><p className="text-xs text-[#64748B]">{position.status || 'active'}{position.balance ? ` - balance ${currency(position.balance)}` : ''}</p></div>)}</div> : <p className="mt-4 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#64748B]">No recurring daily or weekly debit positions are currently on file for this deal.</p>}</CrmCard><div className="lg:col-span-2"><SimpleRows rows={dealActivity.slice(0, 5)} empty="No recent activity yet." render={(row) => <div><b>{row.title || 'Activity'}</b><p className="text-[#334155]">{row.body}</p><p className="text-xs text-[#64748B]">{date(row.created_at)}</p></div>} /></div></div></TabsContent>
          <TabsContent value="readiness"><div className="mb-4 grid gap-3 md:grid-cols-2"><ReadinessCard title="Submission readiness" readiness={submissionReadiness} tone="#0F2B5B" /><ReadinessCard title="Funding readiness" readiness={fundingReadiness} tone="#059669" /></div><ChecklistTable rows={checklist} /></TabsContent>
          <TabsContent value="documents"><div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div className="flex gap-2"><Select value={documentFilter} onValueChange={setDocumentFilter}><SelectTrigger className="h-9 w-[180px] rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All docs</SelectItem>{['uploaded','in_review','approved','rejected','needs_replacement','expired'].map((status) => <SelectItem key={status} value={status}>{status.replaceAll('_',' ')}</SelectItem>)}{DETAIL_DOCUMENT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div><Button data-testid="deal-upload-document" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={() => setDocumentDialogOpen(true)}><Upload className="mr-2 h-4 w-4" />Upload / replace document</Button></div>{missingDocItems.length > 0 && <div className="mb-4 rounded-[8px] border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-900">Missing required documents</p><div className="mt-2 flex flex-wrap gap-2">{missingDocItems.map((item) => <button key={item.id} className="rounded-[6px] border border-amber-300 bg-white px-2 py-1 text-xs text-amber-900" onClick={() => updateChecklistItem(item, 'requested')}>{item.name}</button>)}</div></div>}{groupedDocs.length ? <div className="grid gap-3">{groupedDocs.map((group) => <div key={group.type.value} className="rounded-[8px] border border-[#E2E8F0]"><div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold">{group.type.label}</div>{group.docs.map((row) => <div key={row.id} className="grid gap-2 border-b border-[#E2E8F0] p-3 text-sm last:border-b-0 md:grid-cols-[24px_1.4fr_1fr_120px_260px]"><span className="text-[#64748B]">{fileIcon(row.file_name)}</span><b>{row.label || row.file_name}<span className="ml-2 text-xs font-normal text-[#64748B]">{formatBytes(row.file_size)}</span></b><StatusBadge value={row.status} /><span>{date(row.updated_at || row.created_at)}</span><span className="flex flex-wrap gap-1"><Button size="sm" variant="outline" className="h-8" onClick={() => openDealDocument(row, 'preview')}><Eye className="mr-1 h-3 w-3" />Preview</Button><Button size="sm" variant="outline" className="h-8" onClick={() => openDealDocument(row, 'download')}><Download className="h-3 w-3" /></Button><Button size="sm" variant="outline" className="h-8" onClick={() => updateDocumentStatus(row, 'approved')}>Approve</Button><Button size="sm" variant="outline" className="h-8" onClick={() => updateDocumentStatus(row, 'needs_replacement', window.prompt('Replacement reason') || 'Replacement requested')}>Request replacement</Button><Button size="sm" variant="outline" className="h-8" onClick={() => updateDocumentStatus(row, 'rejected', window.prompt('Reject reason') || 'Rejected')}>Reject</Button></span></div>)}</div>)}</div> : <EmptyState title="No documents attached." body="Upload documents here so this deal page remains the source of truth." />}</TabsContent>
          <TabsContent value="notes"><div className="mb-3 flex justify-end"><Button data-testid="deal-add-note" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={() => setNoteDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Add note</Button></div><SimpleRows rows={dealNotes} empty="No notes yet." render={(row) => <div><b>{row.is_internal ? 'Internal note' : 'Shared note'}</b><p className="text-[#334155]">{row.body || row.note}</p><p className="text-xs text-[#64748B]">{date(row.created_at)}</p></div>} /></TabsContent>
          <TabsContent value="lenders"><CrmCard className="mb-4 p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase text-[#64748B]">Available Lenders</p><h2 className="text-lg font-semibold text-[#0F172A]">{positionCount} active position{positionCount === 1 ? "" : "s"}</h2></div><span className="rounded-full bg-[#0F2B5B] px-3 py-1 text-sm font-semibold text-white">{partnerMatches.length} eligible</span></div>{partnerMatches.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{partnerMatches.map((match) => <div key={match.partner.id} className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm"><div className="flex items-start justify-between gap-2"><b>{match.partner.name}</b><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#0F2B5B]">{match.fitScore}% fit</span></div><p className="mt-2 text-xs text-[#64748B]">{match.partner.submission_email || match.partner.portal_url || "Submission route not set"}</p><p className="mt-2 text-xs text-[#334155]">{match.misses.length ? match.misses.join(", ") : "Matches deal profile and position count."}</p></div>)}</div> : <EmptyState title="No eligible lenders matched." body="Review partner criteria or position count before submitting." />}</CrmCard><div className="mb-3 flex justify-end">{canSendToLenders ? <Button data-testid="deal-submit-lender" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={() => { setSubmissionPartnerIds([]); setSubmissionDialogOpen(true); }}><Send className="mr-2 h-4 w-4" />Send to Lender</Button> : <Button data-testid="deal-submit-lender-disabled" className="h-9 rounded-[7px]" variant="outline" disabled>Only admins and sales reps can send</Button>}</div><SimpleRows rows={dealSubmissions} empty="No lender submissions yet." render={(row) => { const relatedOffer = dealOffers.find((o: RecordMap) => o.partner_submission_id === row.id || o.funding_partner_id === row.funding_partner_id); return <div className="grid gap-3 md:grid-cols-[1.2fr_170px_1fr_1fr_220px]"><div><b>{partnerName(row)}</b><p className="text-xs text-[#64748B]">{row.funding_partners?.submission_email || row.funding_partners?.portal_url || 'No route saved'}</p><p className="text-xs text-[#64748B]">Sent {date(row.submitted_at || row.created_at)} · Updated {date(row.updated_at)}</p></div><Select value={row.status || 'draft'} onValueChange={(status) => updateSubmission(row, { status })}><SelectTrigger data-testid={`lender-status-${row.id}`} className="h-9 rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent>{['draft','submitted','in_review','more_info_needed','approved','declined','withdrawn','funded'].map((status) => <SelectItem key={status} value={status}>{status.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select><div><p className="text-xs font-semibold uppercase text-[#64748B]">Internal note</p><p>{row.notes || 'No internal note'}</p><Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => updateSubmission(row, { notes: window.prompt('Internal note', row.notes || '') || row.notes })}>Edit internal</Button></div><div><p className="text-xs font-semibold uppercase text-[#64748B]">Lender note</p><p>{row.custom_message || 'No lender note'}</p><Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => updateSubmission(row, { custom_message: window.prompt('Lender-facing note', row.custom_message || '') || row.custom_message })}>Edit lender note</Button></div><div>{relatedOffer ? <div><b>{currency(relatedOffer.approved_amount)}</b><p>{relatedOffer.factor_rate || 'N/A'} factor · {relatedOffer.term_days || 'N/A'} days</p><StatusBadge value={relatedOffer.status} /></div> : <Button size="sm" className="h-8 bg-[#0F2B5B]" onClick={() => convertSubmissionToOffer(row)}>Convert to offer</Button>}<Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => updateSubmission(row, { decline_reason: window.prompt('Decline reason or conditions', row.decline_reason || row.conditions || '') || row.decline_reason })}>Reason/stips</Button></div></div>; }} /></TabsContent>
          <TabsContent value="offers"><div data-testid="offer-comparison-view">{dealOffers.length ? <><div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{offerInsights.highlights.map(([label, value]) => <CrmCard key={label} className="p-3"><p className="text-[11px] font-semibold uppercase text-[#64748B]">{label}</p><p className="mt-1 text-sm font-semibold text-[#0F172A]">{value}</p></CrmCard>)}</div><div className="grid gap-3 md:grid-cols-2">{dealOffers.map((row: RecordMap) => <CrmCard key={row.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><b>{partnerName(row)}</b><p className="text-xs text-[#64748B]">Expires {date(row.expires_at)}</p></div>{offerInsights.recommended?.id === row.id && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Recommended Offer</span>}</div><InfoGrid rows={[["Approved", currency(row.approved_amount)], ["Factor", row.factor_rate || 'N/A'], ["Buy / sell", `${row.buy_rate || 'N/A'} / ${row.sell_rate || 'N/A'}`], ["Payback", currency(row.payback_amount)], ["Term", `${row.term_days || 'N/A'} days`], ["Payment", currency(row.daily_payment || row.weekly_payment)], ["Frequency", row.payment_frequency || 'N/A'], ["Net funding", currency(row.net_funding_amount || row.approved_amount)], ["Holdback", pct(row.holdback_pct)], ["Origination fee", currency(row.origination_fee)], ["Broker commission", `${row.broker_commission_pct || 0}%`], ["ISO commission", `${row.iso_commission_pct || 0}%`], ["Stips", Array.isArray(row.stips_required) && row.stips_required.length ? row.stips_required.join(', ') : 'None'], ["Status", <StatusBadge key="status" value={row.status} />], ["Notes", row.notes || 'None']]} /></CrmCard>)}</div></> : <EmptyState title="No offers received yet." body="Convert lender responses into offers to compare terms and recommendations." />}</div></TabsContent>
          {canViewFinance && <TabsContent value="finance"><div className="grid gap-4"><InfoGrid rows={[["Funded amount", currency(deal.funded_amount)], ["Referral partner split", `${deal.referral_partner_commission_pct ?? 20}%`], ["Junior closer split", `${deal.junior_closer_commission_pct ?? 5}%`], ["Senior closer split", `${deal.senior_closer_commission_pct ?? 10}%`], ["Clawback amount", currency(deal.commission_clawback_amount)], ["Default status", deal.defaulted_at ? `Defaulted ${date(deal.defaulted_at)}` : 'No default recorded']]} /><div className="grid gap-4 lg:grid-cols-2"><CrmCard className="p-4"><h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Commission recipients</h3><div className="mb-3 grid gap-2 md:grid-cols-2"><Input placeholder="Recipient name" value={commissionForm.recipient_name || ''} onChange={(e) => setCommissionForm({ ...commissionForm, recipient_name: e.target.value })} /><Select value={commissionForm.recipient_type || 'referral_partner'} onValueChange={(value) => setCommissionForm({ ...commissionForm, recipient_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['referral_partner','junior_closer','senior_closer','broker','sales_rep','processor','other'].map((type) => <SelectItem key={type} value={type}>{type.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select><Input placeholder="Percent" value={commissionForm.percentage || ''} onChange={(e) => setCommissionForm({ ...commissionForm, percentage: e.target.value })} /><Input placeholder="Flat amount optional" value={commissionForm.flat_amount || ''} onChange={(e) => setCommissionForm({ ...commissionForm, flat_amount: e.target.value })} /><Input className="md:col-span-2" placeholder="Notes" value={commissionForm.notes || ''} onChange={(e) => setCommissionForm({ ...commissionForm, notes: e.target.value })} /><Button className="bg-[#0F2B5B]" onClick={saveCommissionRecipient}>Add recipient</Button></div><SimpleRows rows={dealCommissionRecipients.length ? dealCommissionRecipients : dealCommissions} empty="No commissions tracked for this deal yet." render={(row) => <div className="grid gap-2 md:grid-cols-[1fr_120px_140px_120px]"><b>{row.recipient_name || row.notes || row.payment_status || 'Commission'}</b><span>{Number(row.percentage ?? row.commission_pct ?? 0).toFixed(2)}%</span><span>{currency(row.flat_amount || row.commission_amount)}</span><StatusBadge value={row.payout_status || row.payment_status || 'pending'} /></div>} /></CrmCard><CrmCard className="p-4"><h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Risk and default events</h3><div className="mb-3 grid gap-2 md:grid-cols-2"><Select value={riskForm.event_type || 'defaulted'} onValueChange={(value) => setRiskForm({ ...riskForm, event_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['funded','defaulted','closed_not_funded','clawback','risk_note','judgment','lien','tax_lien','ucc','bankruptcy','court_record','public_record'].map((type) => <SelectItem key={type} value={type}>{type.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select><Select value={riskForm.funding_partner_id || 'none'} onValueChange={(value) => setRiskForm({ ...riskForm, funding_partner_id: value === 'none' ? '' : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No lender</SelectItem>{partners.map((partner: RecordMap) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}</SelectContent></Select><Input placeholder="Amount optional" value={riskForm.amount || ''} onChange={(e) => setRiskForm({ ...riskForm, amount: e.target.value })} /><Input placeholder="Notes" value={riskForm.notes || ''} onChange={(e) => setRiskForm({ ...riskForm, notes: e.target.value })} /><Button className="bg-[#0F2B5B]" onClick={saveRiskEvent}>Record event</Button></div><SimpleRows rows={dealRiskEvents} empty="No risk history yet." render={(row) => <div className="grid gap-2 md:grid-cols-[1fr_1fr_120px]"><b>{row.event_type?.replaceAll('_',' ')}</b><span>{row.funding_partners?.name || row.notes || 'No lender'}</span><span>{date(row.event_date || row.created_at)}</span></div>} /></CrmCard></div></div></TabsContent>}
          <TabsContent value="history"><div data-testid="merchant-history-view" className="grid gap-3"><div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#334155]">Merchant history is grouped by business match and repeat-submission linkage. Review prior lender outcomes and default events before packaging this file.</div><SimpleRows rows={historyDeals} empty="No prior submissions for this merchant." render={(historyDeal) => { const historySubmissions = partnerSubmissions.filter((row: RecordMap) => row.deal_id === historyDeal.id); const historyRisk = riskEvents.filter((row: RecordMap) => row.deal_id === historyDeal.id || row.business_id === historyDeal.business_id); const historyNotes = notes.filter((row: RecordMap) => row.deal_id === historyDeal.id).slice(0, 2); return <div data-testid={`merchant-history-${historyDeal.id}`} className="grid gap-3 md:grid-cols-[1.1fr_1fr_1fr_1fr]"><div><b>{businessName(historyDeal)} #{historyDeal.submission_sequence || historyDeals.indexOf(historyDeal) + 1}</b><p className="text-xs text-[#64748B]">Created {date(historyDeal.created_at)} · {stageLabel(historyDeal.stage_slug)}</p></div><div><p className="text-xs font-semibold uppercase text-[#64748B]">Funding</p><p>{historyDeal.funded_at || Number(historyDeal.funded_amount || 0) > 0 ? `Funded ${currency(historyDeal.funded_amount)}` : 'Not funded'}</p></div><div><p className="text-xs font-semibold uppercase text-[#64748B]">Lenders</p><p>{historySubmissions.length ? historySubmissions.map((row: RecordMap) => `${partnerName(row)} (${row.status || 'submitted'})`).join(', ') : 'No lender submissions'}</p></div><div><p className="text-xs font-semibold uppercase text-[#64748B]">Risk and notes</p><p>{historyRisk.length ? historyRisk.map((row: RecordMap) => `${row.event_type?.replaceAll('_',' ')}${row.funding_partners?.name ? ` with ${row.funding_partners.name}` : ''}`).join(', ') : 'No risk events'}</p>{historyNotes.map((row: RecordMap) => <p key={row.id} className="mt-1 text-xs text-[#64748B]">{row.body || row.note}</p>)}</div></div>; }} /></div></TabsContent>
          <TabsContent value="tasks"><div className="mb-4 grid gap-3 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 md:grid-cols-[1fr_170px_150px_auto]"><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Create deal task" className="rounded-[7px]" /><Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="rounded-[7px]" /><Select value={taskPriority} onValueChange={setTaskPriority}><SelectTrigger className="rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent>{['low','medium','high','urgent'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><Button onClick={createTask} className="bg-[#0F2B5B]">Create task</Button></div><SimpleRows rows={dealTasks} empty="No deal tasks yet." render={(row) => <div className={`grid gap-2 md:grid-cols-[1.5fr_1fr_120px_120px_100px] ${overdueTasks.some((task) => task.id === row.id) ? 'text-[#DC2626]' : ''}`}><b>{row.title}</b><span>{repName({ user_profiles: row.assigned_user })}</span><span>{date(row.due_date)}</span><StatusBadge value={row.priority} /><span>{row.status === 'completed' ? <StatusBadge value="completed" /> : <Button size="sm" variant="outline" className="h-8" onClick={() => completeTask(row)}>Complete</Button>}</span></div>} /></TabsContent>
          <TabsContent value="activity"><SimpleRows rows={dealActivity} empty="No activity yet." render={(row) => <div><b>{row.title || row.action || 'Activity'}</b><p className="text-[#334155]">{row.body}</p><p className="text-xs text-[#64748B]">{row.activity_type ? `${row.activity_type.replaceAll('_', ' ')} · ` : ''}{date(row.created_at)}{row.performed_by ? ` · User ${shortId(row.performed_by)}` : ''}</p></div>} /></TabsContent>
        </Tabs>
      </CrmCard>
      <Dialog open={documentDialogOpen} onOpenChange={(open) => { setDocumentDialogOpen(open); if (!open) resetDocumentDialog(); }}><DialogContent className="max-w-xl rounded-[8px]"><DialogHeader><DialogTitle>Upload or replace deal document</DialogTitle></DialogHeader><div className="grid gap-4"><div><Label className="text-xs text-[#64748B]">Document file</Label><Input data-testid="deal-document-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" onChange={(event) => setDocumentFile(event.target.files?.[0] || null)} className="mt-1 rounded-[7px]" />{documentFile && <p className="mt-1 text-xs text-[#64748B]">{documentFile.name} · {formatBytes(documentFile.size)}</p>}</div><div><Label className="text-xs text-[#64748B]">Document type</Label><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger data-testid="deal-document-type" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent>{DETAIL_DOCUMENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs text-[#64748B]">Description / replacement note</Label><Input data-testid="deal-document-description" value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} className="mt-1 rounded-[7px]" placeholder="Optional document note" /></div></div><DialogFooter><Button variant="outline" onClick={() => setDocumentDialogOpen(false)}>Cancel</Button><Button data-testid="deal-save-document" onClick={uploadDealDocument} disabled={uploadingDocument || !documentFile}>{uploadingDocument ? 'Uploading...' : 'Upload document'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}><DialogContent className="max-w-xl rounded-[8px]"><DialogHeader><DialogTitle>Add deal note</DialogTitle></DialogHeader><div className="grid gap-4"><div><Label className="text-xs text-[#64748B]">Note</Label><Textarea data-testid="deal-note-body" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} className="mt-1 min-h-[120px] rounded-[7px]" placeholder="Add underwriting, merchant, or document context..." /></div><label className="flex items-center gap-2 text-sm font-medium text-[#0F172A]"><input type="checkbox" checked={noteInternal} onChange={(event) => setNoteInternal(event.target.checked)} />Internal note</label></div><DialogFooter><Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button><Button data-testid="deal-save-note" onClick={saveDealNote} disabled={savingNote}>{savingNote ? 'Saving...' : 'Save note'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={submissionDialogOpen} onOpenChange={setSubmissionDialogOpen}>
        <DialogContent className="grid h-[90vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[8px]" style={{ top: '5vh', transform: 'translateX(-50%)' }}>
          <DialogHeader><DialogTitle>Submit deal to lender</DialogTitle></DialogHeader>
          <div className="grid min-h-0 gap-4 overflow-y-auto pr-1">
            <div><Label className="text-xs text-[#64748B]">Choose lenders</Label><div data-testid="deal-submission-lenders" className="mt-2 max-h-[150px] overflow-y-auto rounded-[8px] border border-[#E2E8F0]">{(partnerMatches.length ? partnerMatches.map((match) => match.partner) : partners).map((partner: RecordMap) => <label key={partner.id} className="flex items-start gap-3 border-b border-[#E2E8F0] p-3 text-sm last:border-b-0"><input data-testid={`deal-submission-lender-${partner.id}`} type="checkbox" checked={submissionPartnerIds.includes(partner.id)} onChange={(event) => setSubmissionPartnerIds((current) => event.target.checked ? Array.from(new Set([...current, partner.id])) : current.filter((id) => id !== partner.id))} /><span className="min-w-0 flex-1"><b className="block truncate">{partner.name}</b><span className="block text-xs text-[#64748B]">{partner.submission_email || partner.email || partner.portal_url || 'No submission route saved'}</span></span></label>)}</div><p className="mt-1 text-xs text-[#64748B]">Only checked lenders get the package. Nothing is sent to unchecked lenders.</p></div>
            {selectedSubmissionPartners.some((partner: RecordMap) => !(partner.submission_email || partner.email)) && <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">One or more selected lenders has no submission email. Add a submission email before sending.</div>}
            {selectedPartnerDefaultEvents.length > 0 && <div data-testid="lender-default-warning" className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>Prior default with selected lender.</b><p className="mt-1">This merchant has {selectedPartnerDefaultEvents.length} default event(s) tied to selected lenders. Review history before sending.</p></div>}
            <div><Label className="text-xs text-[#64748B]">Lender-facing note</Label><Textarea data-testid="deal-submission-notes" value={submissionNotes} onChange={(event) => setSubmissionNotes(event.target.value)} className="mt-1 min-h-[80px] rounded-[7px]" placeholder="This goes to the selected lender(s). Add deal specifics, packaging notes, and what you want the lender to review." /></div>
            <div><Label className="text-xs text-[#64748B]">Internal note</Label><Textarea data-testid="deal-submission-internal-notes" value={submissionInternalNotes} onChange={(event) => setSubmissionInternalNotes(event.target.value)} className="mt-1 min-h-[70px] rounded-[7px]" placeholder="Internal-only note for our team. This is saved on the lender submission and is not sent in the lender email." /></div>
            <div>
              <Label className="text-xs text-[#64748B]">Selected attachments</Label>
              <div className="mt-2 max-h-[140px] overflow-y-auto rounded-[8px] border border-[#E2E8F0]">
                {dealDocs.length ? dealDocs.map((doc: RecordMap) => (
                  <label key={doc.id} className="flex items-center gap-3 border-b border-[#E2E8F0] p-3 text-sm last:border-b-0">
                    <input type="checkbox" checked={submissionDocumentIds.includes(doc.id)} onChange={(event) => setSubmissionDocumentIds((current) => event.target.checked ? Array.from(new Set([...current, doc.id])) : current.filter((id) => id !== doc.id))} />
                    <span className="min-w-0 flex-1 truncate">{doc.file_name}</span>
                    <span className="text-xs text-[#64748B]">{detailDocTypeLabel(doc.document_type)}</span>
                    <StatusBadge value={doc.status || 'uploaded'} />
                  </label>
                )) : <p className="p-3 text-sm text-[#64748B]">No documents attached to this deal yet.</p>}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">The completed application PDF is generated and included automatically. Select any additional statements or documents to send with it.</p>
            </div>
          </div>
          <DialogFooter className="-mx-6 bg-white px-6 pt-3"><Button variant="outline" onClick={() => setSubmissionDialogOpen(false)}>Cancel</Button><Button data-testid="deal-save-submission" onClick={submitToLender} disabled={savingSubmission || !submissionPartnerIds.length}>{savingSubmission ? 'Submitting...' : `Send to ${submissionPartnerIds.length || ''} Lender${submissionPartnerIds.length === 1 ? '' : 's'}`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}

function InfoGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map(([label, value]) => <div key={label} className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3"><p className="text-[11px] font-semibold uppercase text-[#64748B]">{label}</p><div className="mt-1 text-sm font-semibold text-[#0F172A]">{value}</div></div>)}</div>;
}

function SimpleRows({ rows, empty, render }: { rows: RecordMap[]; empty: string; render: (row: RecordMap) => React.ReactNode }) {
  return rows.length ? <div className="divide-y divide-[#E2E8F0] rounded-[8px] border border-[#E2E8F0]">{rows.map((row) => <div key={row.id} className="p-3 text-sm">{render(row)}</div>)}</div> : <EmptyState title={empty} body="This section is ready for broker workflow data." />;
}

export function CrmEarningsExperience() {
  const { commissions, loading } = useCrmDataset();
  const [search, setSearch] = useState('');
  if (loading) return <LoadingScreen title="Earnings" />;
  const filtered = commissions.filter((row: RecordMap) => normalize([businessName(row.deals || {}), repName(row), partnerName(row.offers || {}), row.payment_status].join(' ')).includes(normalize(search)));
  const paid = filtered.filter((row: RecordMap) => row.payment_status === 'paid').reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0);
  const unpaid = filtered.filter((row: RecordMap) => row.payment_status !== 'paid').reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0);
  return (
    <PageFrame title="Earnings" subtitle="Rep commissions, partner economics, paid and unpaid earnings">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard title="Gross Commission" value={currency(paid + unpaid)} subtitle="All booked earnings" icon={<WalletCards className="h-4 w-4" />} />
        <MetricCard title="Net Commission" value={currency((paid + unpaid) * 0.92)} subtitle="After estimated offsets" icon={<TrendingUp className="h-4 w-4" />} tone="#059669" />
        <MetricCard title="Paid" value={currency(paid)} subtitle="Received from partners" icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" />
        <MetricCard title="Unpaid" value={currency(unpaid)} subtitle="Pending receivable" icon={<CalendarClock className="h-4 w-4" />} tone="#D97706" />
      </div>
      <CrmCard>
        <Toolbar search={search} setSearch={setSearch}>
          <Button variant="outline" className="h-10 rounded-[7px]" onClick={() => exportCsv('earnings', filtered)}><Download className="mr-2 h-4 w-4" />Export</Button>
        </Toolbar>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr>{['Funded Deal', 'Commission %', 'Gross', 'Net', 'Paid/Unpaid', 'Payment Date', 'Funding Partner', 'Sales Rep'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#E2E8F0]">{filtered.map((row: RecordMap) => <tr key={row.id} className="hover:bg-[#F8FAFC]"><td className="px-4 py-3 font-semibold">{businessName(row.deals || {})}</td><td className="px-4 py-3">{Number(row.commission_pct || 0).toFixed(2)}%</td><td className="px-4 py-3">{currency(row.commission_amount)}</td><td className="px-4 py-3">{currency(Number(row.commission_amount || 0) * 0.92)}</td><td className="px-4 py-3"><StatusBadge value={row.payment_status} /></td><td className="px-4 py-3">{date(row.paid_date)}</td><td className="px-4 py-3">{partnerName(row.offers || {})}</td><td className="px-4 py-3">{repName(row)}</td></tr>)}</tbody>
          </table>
        </div>
      </CrmCard>
    </PageFrame>
  );
}

export function CrmReportsExperience() {
  const { leads, deals, offers, renewals, commissions, partners, users, loading } = useCrmDataset();
  const [dateRange, setDateRange] = useState('90d');
  if (loading) return <LoadingScreen title="Reports" />;
  const cutoff = dateRange === 'all' ? null : new Date(Date.now() - (dateRange === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000);
  const inRange = (row: RecordMap, field = 'created_at') => !cutoff || !row[field] || new Date(row[field]) >= cutoff;
  const rangedLeads = leads.filter((row: RecordMap) => inRange(row));
  const rangedDeals = deals.filter((row: RecordMap) => inRange(row));
  const rangedOffers = offers.filter((row: RecordMap) => inRange(row));
  const rangedRenewals = renewals.filter((row: RecordMap) => inRange(row, 'updated_at'));
  const rangedCommissions = commissions.filter((row: RecordMap) => inRange(row, row.paid_date ? 'paid_date' : 'created_at'));
  const conversion = [
    { name: 'Lead volume', value: rangedLeads.length },
    { name: 'Submissions', value: rangedDeals.filter((row: RecordMap) => ['application_submitted', 'underwriting_review', 'offers_received', 'offer_presented', 'contract_sent', 'contract_signed', 'funded'].includes(row.stage_slug)).length },
    { name: 'Offers', value: rangedOffers.length },
    { name: 'Funded', value: rangedDeals.filter((row: RecordMap) => row.stage_slug === 'funded' || row.funded_at).length },
    { name: 'Renewals', value: rangedRenewals.length },
  ];
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - index));
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return { month, funded: rangedDeals.filter((deal: RecordMap) => new Date(deal.funded_at || deal.created_at).getMonth() === d.getMonth()).reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0) };
  });
  const fundedDeals = rangedDeals.filter((row: RecordMap) => row.stage_slug === 'funded' || row.funded_at);
  const reportRows = [
    { name: 'Deals', value: rangedDeals.length, rows: rangedDeals },
    { name: 'Funding', value: currency(fundedDeals.reduce((sum: number, row: RecordMap) => sum + Number(row.funded_amount || 0), 0)), rows: fundedDeals },
    { name: 'Renewals', value: rangedRenewals.length, rows: rangedRenewals },
    { name: 'Earnings', value: currency(rangedCommissions.reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0)), rows: rangedCommissions },
    { name: 'User performance', value: users.length, rows: users.map((user: RecordMap) => ({ email: user.email, role: user.role, active: user.is_active, deals: rangedDeals.filter((deal: RecordMap) => deal.assigned_user_id === user.id).length, earnings: rangedCommissions.filter((row: RecordMap) => row.rep_id === user.id).reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0) })) },
    { name: 'Funding partner performance', value: partners.length, rows: partners.map((partner: RecordMap) => ({ name: partner.name, offers: rangedOffers.filter((offer: RecordMap) => offer.funding_partner_id === partner.id).length, approved_amount: rangedOffers.filter((offer: RecordMap) => offer.funding_partner_id === partner.id).reduce((sum: number, offer: RecordMap) => sum + Number(offer.approved_amount || 0), 0) })) },
    { name: 'Approved but not accepted', value: rangedOffers.filter((offer: RecordMap) => ['received', 'presented', 'approved'].includes(offer.status)).length, rows: rangedOffers.filter((offer: RecordMap) => ['received', 'presented', 'approved'].includes(offer.status)) },
  ];
  const exportPack = () => {
    exportCsv('crm-report-pack', reportRows.flatMap((report) => report.rows.map((row: RecordMap) => ({ report: report.name, ...row }))));
  };
  return (
    <PageFrame title="Reports" subtitle="Date-filtered MCA production, rep, partner, renewal, and earnings reports" actions={<div className="flex gap-2"><Select value={dateRange} onValueChange={setDateRange}><SelectTrigger className="h-9 w-[130px] rounded-[7px]"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30d">Last 30 days</SelectItem><SelectItem value="90d">Last 90 days</SelectItem><SelectItem value="all">All time</SelectItem></SelectContent></Select><Button className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={exportPack}><Download className="mr-2 h-4 w-4" />Export pack</Button></div>}>
      <div className="grid gap-4 xl:grid-cols-2">
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Pipeline Conversion</h2><ResponsiveContainer width="100%" height={290}><BarChart data={conversion}><CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#0F2B5B" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></CrmCard>
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Funded Volume Trend</h2><ResponsiveContainer width="100%" height={290}><LineChart data={monthly}><CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => currency(value)} /><Line type="monotone" dataKey="funded" stroke="#C9A84C" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></CrmCard>
      </div>
      <CrmCard className="mt-4 overflow-hidden">
        <table className="w-full text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">Report</th><th className="px-4 py-3">Current value</th><th className="px-4 py-3">Exports</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-[#E2E8F0]">{reportRows.map((report) => <tr key={report.name}><td className="px-4 py-3 font-semibold">{report.name}</td><td className="px-4 py-3">{report.value}</td><td className="px-4 py-3">CSV</td><td className="px-4 py-3"><Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => exportCsv(`crm-${report.name.toLowerCase().replaceAll(' ', '-')}`, report.rows)}>Export</Button></td></tr>)}</tbody></table>
      </CrmCard>
    </PageFrame>
  );
}

export function CrmToolsExperience() {
  const tools = [
    ['Advanced deal search', 'Find deals by merchant, stage, balance, partner, or rep.', Search, '/crm/deals'],
    ['Advanced earnings search', 'Search paid, unpaid, rep, and partner commission records.', WalletCards, '/crm/earnings'],
    ['Renewal search', 'Locate eligible merchants by paydown, payoff date, and flags.', RefreshCw, '/crm/renewals'],
    ['Funding partner management', 'Maintain funder criteria, contacts, and product rules.', Building2, '/crm/partners'],
    ['Stage management', 'Review MCA stage definitions and pipeline routing.', SlidersHorizontal, '/crm/pipeline'],
    ['Import/export tools', 'Prepare CSV exports and future import mapping.', Database, '/crm/reports'],
    ['User management', 'Create, activate, deactivate, and measure CRM users.', Users, '/crm/users'],
    ['System settings', 'Organization, security, and connected-service settings.', Settings, '/crm/settings'],
  ];
  return (
    <PageFrame title="Tools" subtitle="Broker operations utilities and admin shortcuts">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tools.map(([title, body, Icon, href]: any) => (
          <Link key={title} href={href} className="rounded-[8px] border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[#C9A84C] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#F1F5F9] text-[#0F2B5B]"><Icon className="h-4 w-4" /></div>
            <h2 className="mt-4 text-sm font-semibold text-[#0F172A]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">{body}</p>
          </Link>
        ))}
      </div>
    </PageFrame>
  );
}

export function CrmRenewalsExperience() {
  const { renewals, deals, loading } = useCrmDataset();
  if (loading) return <LoadingScreen title="Renewals" />;
  const rows = renewals.length ? renewals : deals.filter((deal: RecordMap) => deal.stage_slug === 'funded' || deal.stage_slug === 'renewal_eligible').map((deal: RecordMap) => ({
    id: deal.id,
    deals: deal,
    original_funded_amount: deal.funded_amount,
    current_balance: Number(deal.funded_amount || 0) * 0.45,
    percent_paid_down: 55,
    renewal_date: deal.funded_at,
    status: deal.stage_slug === 'renewal_eligible' ? 'eligible' : 'eligible_soon',
    notes: 'Review latest bank statements before outreach.',
  }));
  const readyCount = rows.filter((row: RecordMap) => getRenewalSignal(row).status === 'renewal_ready').length;
  const soonCount = rows.filter((row: RecordMap) => getRenewalSignal(row).status === 'renewal_soon').length;
  return (
    <PageFrame title="Renewals" subtitle="Paydown, eligibility, probability, and renewal alerts">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard title="Renewal Ready" value={readyCount} subtitle="Refresh bank statements now" icon={<RefreshCw className="h-4 w-4" />} tone="#059669" />
        <MetricCard title="Coming Soon" value={soonCount} subtitle="Schedule merchant check-ins" icon={<CalendarClock className="h-4 w-4" />} tone="#D97706" />
        <MetricCard title="Portfolio Watch" value={rows.length} subtitle="Funded merchants monitored" icon={<WalletCards className="h-4 w-4" />} tone="#0F2B5B" />
        <MetricCard title="Avg Probability" value={rows.length ? pct(rows.reduce((sum: number, row: RecordMap) => sum + getRenewalSignal(row).probability, 0) / rows.length) : '0%'} subtitle="Based on paydown and age" icon={<TrendingUp className="h-4 w-4" />} tone="#2563EB" />
      </div>
      <CrmCard className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr>{['Merchant', 'Funded date', 'Funded amount', 'Current balance', '% paid down', 'Days funded', 'Eligibility', 'Probability', 'Next action', 'Status'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{rows.map((row: RecordMap) => { const signal = getRenewalSignal(row); return <tr key={row.id}><td className="px-4 py-3 font-semibold">{businessName(row.deals || row)}</td><td className="px-4 py-3">{date(row.deals?.funded_at)}</td><td className="px-4 py-3">{currency(row.original_funded_amount || row.deals?.funded_amount)}</td><td className="px-4 py-3">{currency(row.current_balance)}</td><td className="px-4 py-3">{pct(signal.paidDown)}</td><td className="px-4 py-3">{signal.daysSinceFunding}</td><td className="px-4 py-3">{date(row.renewal_date)}</td><td className="px-4 py-3">{pct(signal.probability)}</td><td className="px-4 py-3 text-[#334155]">{signal.nextAction}</td><td className="px-4 py-3"><StatusBadge value={signal.status} /></td></tr>; })}</tbody></table>
      </CrmCard>
    </PageFrame>
  );
}

export function CrmUsersExperience() {
  const { users, deals, commissions, profile, organizationId, loading, reload } = useCrmDataset();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RecordMap>(emptyUser);
  const [editingUser, setEditingUser] = useState<RecordMap | null>(null);
  if (loading) return <LoadingScreen title="Users" />;
  const canCreateUsers = ['super_admin', 'admin'].includes(profile?.role || '');
  const openCreateUser = () => {
    setEditingUser(null);
    setForm(emptyUser);
    setDialogOpen(true);
  };
  const openEditUser = (user: RecordMap) => {
    setEditingUser(user);
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      role: user.role || 'sales_rep',
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      is_active: user.is_active !== false,
      referral_slug: user.referral_slug || '',
    });
    setDialogOpen(true);
  };
  const saveUser = async () => {
    if (!canCreateUsers) {
      toast.error('Only admins can manage users.');
      return;
    }
    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      role: form.role,
      permissions: Array.isArray(form.permissions) ? form.permissions : [],
      is_active: form.is_active,
      referral_slug: form.referral_slug || undefined,
    };
    const response = await fetch(editingUser ? `/api/crm/users/${editingUser.id}` : '/api/crm/users', {
      method: editingUser ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to save user');
    else {
      toast.success(editingUser ? 'User updated' : 'User created');
      setDialogOpen(false);
      setEditingUser(null);
      setForm(emptyUser);
      reload();
    }
  };
  const toggleUserActive = async (user: RecordMap) => {
    if (!canCreateUsers) {
      toast.error('Only admins can manage users.');
      return;
    }
    const response = await fetch(`/api/crm/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to update user');
    else {
      toast.success(user.is_active ? 'User deactivated' : 'User activated');
      reload();
    }
  };
  const roles = profile?.role === 'super_admin'
    ? ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'funder', 'iso_broker', 'broker', 'referral_partner', 'viewer', 'client']
    : ['admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'funder', 'iso_broker', 'broker', 'referral_partner', 'viewer', 'client'];
  const togglePermission = (permission: string, checked: boolean) => {
    const current = Array.isArray(form.permissions) ? form.permissions : [];
    setForm({ ...form, permissions: checked ? Array.from(new Set([...current, permission])) : current.filter((item: string) => item !== permission) });
  };
  const copyReferralUrl = async (user: RecordMap) => {
    const url = repReferralUrl(user.referral_slug);
    if (!url) {
      toast.error('This user does not have a referral URL yet.');
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Referral URL copied');
  };
  const permissions = [
    ['super_admin', 'Full platform ownership, users, sensitive reveals, documents, and settings.'],
    ['admin', 'Manage CRM data, users, sensitive reveals, documents, and settings.'],
    ['manager', 'Manage team CRM workflow and documents without user administration.'],
    ['sales_rep', 'Work assigned leads and deals without sensitive-field reveal or user administration.'],
    ['processor', 'Manage documents, applications, tasks, and underwriting support.'],
    ['underwriter', 'Review files, offers, underwriting, and risk workflow.'],
    ['funder', 'Funding partner access for lender submissions, offers, and partner workflow.'],
    ['iso_broker', 'ISO partner access for broker pipeline workflow.'],
    ['broker', 'Broker access for referral and deal workflow.'],
    ['referral_partner', 'Referral partner access for lead and referral workflow.'],
    ['viewer', 'Read-only CRM visibility without write access.'],
    ['client', 'Portal only. Internal CRM access is blocked by middleware.'],
  ];
  return (
    <PageFrame title="User Management" subtitle="Create users, assign roles, activate accounts, and view performance" actions={canCreateUsers ? <Button data-testid="create-user" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={openCreateUser}><Plus className="mr-2 h-4 w-4" />Create user</Button> : null}>
      <CrmCard className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr>{['User', 'Role', 'Status', 'Referral URL', 'Deals', 'Funded volume', 'Earnings', 'Last login', 'Actions'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{users.map((user: RecordMap) => { const userDeals = deals.filter((deal: RecordMap) => deal.assigned_user_id === user.id); const userEarnings = commissions.filter((row: RecordMap) => row.rep_id === user.id).reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0); return <tr key={user.id}><td className="px-4 py-3"><p className="font-semibold">{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</p><p className="text-xs text-[#64748B]">{user.email}</p></td><td className="px-4 py-3 capitalize">{user.role?.replaceAll('_', ' ')}</td><td className="px-4 py-3"><StatusBadge value={user.is_active ? 'active' : 'inactive'} /></td><td className="px-4 py-3"><div className="flex max-w-[360px] items-center gap-2"><code className="truncate rounded bg-[#F1F5F9] px-2 py-1 text-[11px] text-[#334155]" title={repReferralDisplayUrl(user.referral_slug)}>{repReferralDisplayUrl(user.referral_slug)}</code><Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => copyReferralUrl(user)}>Copy</Button></div></td><td className="px-4 py-3">{userDeals.length}</td><td className="px-4 py-3">{currency(userDeals.reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0))}</td><td className="px-4 py-3">{currency(userEarnings)}</td><td className="px-4 py-3">{date(user.last_login_at)}</td><td className="px-4 py-3"><div className="flex gap-2">{canCreateUsers ? <><Button data-testid={`edit-user-${user.id}`} variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => openEditUser(user)}>Edit</Button><Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => toggleUserActive(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</Button></> : <span className="text-xs text-[#64748B]">Read only</span>}</div></td></tr>; })}</tbody></table>
      </CrmCard>
      <CrmCard className="mt-4 p-4">
        <h2 className="text-sm font-semibold text-[#0F172A]">Permission Matrix</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {permissions.map(([role, description]) => <div key={role} className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3"><p className="text-xs font-semibold uppercase text-[#0F2B5B]">{role.replaceAll('_', ' ')}</p><p className="mt-1 text-xs leading-5 text-[#64748B]">{description}</p></div>)}
        </div>
      </CrmCard>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[8px]">
          <DialogHeader><DialogTitle>{editingUser ? 'Edit user' : 'Create user'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['First name', 'first_name'],
              ['Last name', 'last_name'],
              ['Email', 'email'],
              ['Referral slug', 'referral_slug'],
            ].map(([label, key]) => (
              <div key={key}>
                <Label className="text-xs text-[#64748B]">{label}</Label>
                <Input data-testid={`user-${key}`} value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 rounded-[7px]" />
              </div>
            ))}
            <div>
              <Label className="text-xs text-[#64748B]">Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                <SelectTrigger data-testid="user-role" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map((role) => <SelectItem key={role} value={role}>{role.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-[#64748B]">Permissions</Label>
              <div className="mt-2 grid gap-2 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 md:grid-cols-2">
                {USER_PERMISSION_OPTIONS.map(([permission, label]) => (
                  <label key={permission} className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                    <input type="checkbox" checked={(form.permissions || []).includes(permission)} onChange={(event) => togglePermission(permission, event.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
              <input type="checkbox" checked={form.is_active !== false} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
              Active user
            </label>
          </div>
          <DialogFooter><Button data-testid="save-user" onClick={saveUser} className="rounded-[7px] bg-[#0F2B5B]">Save user</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}




