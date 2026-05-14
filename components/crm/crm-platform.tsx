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
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
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

type RecordMap = Record<string, any>;

type CrmDataset = {
  leads: RecordMap[];
  deals: RecordMap[];
  offers: RecordMap[];
  renewals: RecordMap[];
  commissions: RecordMap[];
  partners: RecordMap[];
  users: RecordMap[];
  activities: RecordMap[];
  documents: RecordMap[];
  notes: RecordMap[];
  currentPositions: RecordMap[];
  dealFinancials: RecordMap[];
};

const STAGES = [
  ['verification', 'Verification'],
  ['merchant_interview', 'Merchant Interview'],
  ['submission', 'Submission'],
  ['approved', 'Approved'],
  ['approved_not_accepted', 'Approved Not Accepted'],
  ['working_deal', 'Working Deal'],
  ['contract_requested', 'Contract Requested'],
  ['in_funding', 'In Funding'],
  ['funded', 'Funded'],
  ['declined', 'Declined'],
  ['withdrawn', 'Withdrawn'],
  ['renewal_eligible', 'Renewal Eligible'],
  // Legacy production slugs are kept for existing data compatibility.
  ['lead_captured', 'Verification'],
  ['documents_requested', 'Verification'],
  ['application_started', 'Merchant Interview'],
  ['application_submitted', 'Submission'],
  ['underwriting_review', 'Submission'],
  ['submitted_to_partners', 'Submission'],
  ['offers_received', 'Approved'],
  ['offer_presented', 'Approved'],
  ['contract_sent', 'Contract Requested'],
  ['contract_signed', 'In Funding'],
  ['lost_unresponsive', 'Withdrawn'],
] as const;

const STAGE_LABELS = Object.fromEntries(STAGES);
const STAGE_OPTIONS = STAGES.map(([value, label]) => ({ value, label }));

const PIPELINE_SUMMARY_STAGES = [
  { value: 'verification', label: 'Verification', aliases: ['verification', 'lead_captured', 'documents_requested'] },
  { value: 'merchant_interview', label: 'Merchant Interview', aliases: ['merchant_interview', 'application_started'] },
  { value: 'submission', label: 'Submission', aliases: ['submission', 'application_submitted', 'underwriting_review', 'submitted_to_partners'] },
  { value: 'approved', label: 'Approved', aliases: ['approved', 'offers_received', 'offer_presented'] },
  { value: 'working_deal', label: 'Working Deal', aliases: ['working_deal'] },
  { value: 'contract_requested', label: 'Contract Requested', aliases: ['contract_requested', 'contract_sent'] },
  { value: 'in_funding', label: 'In Funding', aliases: ['in_funding', 'contract_signed'] },
  { value: 'funded', label: 'Funded', aliases: ['funded'] },
];

const APPROVED_NOT_ACCEPTED_REASONS = [
  'Rate too high',
  'Term too short',
  'Merchant went with competitor',
  'Merchant not ready',
  'No response',
  'Other',
];

const RENEWAL_PAID_DOWN_THRESHOLD = 50;
const RENEWAL_DAYS_THRESHOLD = 90;

const STATUS_COLORS = ['#0F2B5B', '#C9A84C', '#2563EB', '#059669', '#D97706', '#DC2626', '#64748B'];
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

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


function dealStageKey(row: RecordMap) {
  const stage = row.stage_slug || row.status || 'verification';
  if (stage === 'offers_received' || stage === 'offer_presented') return 'approved';
  if (stage === 'lead_captured' || stage === 'documents_requested') return 'verification';
  if (stage === 'application_started') return 'merchant_interview';
  if (stage === 'application_submitted' || stage === 'underwriting_review' || stage === 'submitted_to_partners') return 'submission';
  if (stage === 'contract_sent') return 'contract_requested';
  if (stage === 'contract_signed') return 'in_funding';
  if (stage === 'lost_unresponsive') return 'withdrawn';
  return stage;
}

function stageProgress(stage?: string) {
  const order = ['verification', 'merchant_interview', 'submission', 'approved', 'working_deal', 'contract_requested', 'in_funding', 'funded'];
  const idx = Math.max(order.indexOf(dealStageKey({ stage_slug: stage })), 0);
  return Math.round(((idx + 1) / order.length) * 100);
}

function daysBetween(start?: any, end: Date = new Date()) {
  if (!start) return 0;
  const started = new Date(start).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.floor((end.getTime() - started) / 86400000));
}

function renewalMetrics(deal: RecordMap, renewal?: RecordMap, financial: RecordMap = {}, offer: RecordMap = {}) {
  const fundedAmount = Number(renewal?.original_funded_amount || financial.funded_amount || deal.funded_amount || 0);
  const payback = Number(offer.payback_amount || financial.total_payback || renewal?.total_payback || (fundedAmount ? fundedAmount * 1.35 : 0));
  const balance = Number(renewal?.current_balance ?? financial.current_balance ?? Math.max(payback - fundedAmount * 0.45, 0));
  const percentPaid = payback > 0 ? Math.max(0, Math.min(100, ((payback - balance) / payback) * 100)) : Number(renewal?.percent_paid_down || financial.percent_paid_down || 0);
  const fundedAt = deal.funded_at || financial.funded_date;
  const daysSinceFunded = daysBetween(fundedAt);
  const eligible = percentPaid >= RENEWAL_PAID_DOWN_THRESHOLD || daysSinceFunded >= RENEWAL_DAYS_THRESHOLD || dealStageKey(deal) === 'renewal_eligible';
  const status = renewal?.status || (eligible ? 'eligible' : percentPaid >= 40 || daysSinceFunded >= 75 ? 'coming_soon' : 'not_eligible');
  return { fundedAmount, payback, balance, percentPaid, daysSinceFunded, eligible, status };
}

function masked(value?: any, visible = 4) {
  const raw = String(value || '').replace(/\D/g, '');
  if (!raw) return 'Masked';
  return `••-••••${raw.slice(-visible)}`;
}

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

function shortId(id?: string) {
  return id ? id.slice(0, 8).toUpperCase() : 'UNASSIGNED';
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

function stageLabel(stage?: string) {
  return stage ? STAGE_LABELS[stage] || stage.replaceAll('_', ' ') : 'New';
}

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function StatusBadge({ value }: { value?: string | null }) {
  const raw = value || 'new';
  const label = stageLabel(raw);
  const key = normalize(raw).replaceAll(' ', '_');
  const color =
    key.includes('approved_not_accepted') || key.includes('not_accepted') || key.includes('coming_soon') ? '#D97706' :
    key.includes('funded') || key.includes('paid') || key === 'eligible' ? '#059669' :
    key.includes('approved') || key.includes('offer') || key.includes('signed') || key.includes('in_funding') ? '#2563EB' :
    key.includes('renewal') || key.includes('contact') ? '#7C3AED' :
    key.includes('working') ? '#475569' :
    key.includes('declined') || key.includes('lost') || key.includes('withdrawn') || key.includes('overdue') || key.includes('chargeback') ? '#DC2626' :
    key.includes('docs') || key.includes('contract') || key.includes('pending') || key.includes('held') ? '#D97706' :
    '#64748B';
  return (
    <span className="inline-flex min-w-[84px] items-center justify-center rounded-[6px] border px-2.5 py-1 text-[11px] font-semibold capitalize" style={{ color, borderColor: `${color}33`, background: `${color}10` }}>
      {label}
    </span>
  );
}

function CrmCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[8px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>{children}</section>;
}

function MetricCard({ title, value, subtitle, icon, tone = '#0F2B5B' }: { title: string; value: string | number; subtitle: string; icon: React.ReactNode; tone?: string }) {
  return (
    <CrmCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[#64748B]">{title}</p>
          <p className="mt-2 truncate text-[24px] font-semibold tracking-normal text-[#0F172A]">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]" style={{ background: `${tone}12`, color: tone }}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-[12px] text-[#64748B]">{subtitle}</p>
    </CrmCard>
  );
}

function Toolbar({ search, setSearch, children }: { search: string; setSearch: (value: string) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-[420px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search merchants, reps, IDs, partners..." className="h-10 rounded-[7px] border-[#CBD5E1] pl-9 text-[13px]" />
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#F1F5F9] text-[#64748B]"><FileArchive className="h-5 w-5" /></div>
      <p className="mt-3 text-sm font-semibold text-[#0F172A]">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-[#64748B]">{body}</p>
    </div>
  );
}

function exportCsv(name: string, rows: RecordMap[]) {
  const keys = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const csv = [keys.join(','), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function useCrmDataset() {
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
    partners: [],
    users: [],
    activities: [],
    documents: [],
    notes: [],
    currentPositions: [],
    dealFinancials: [],
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
      browserSupabase.from('current_positions').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      browserSupabase.from('deal_financials').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      browserSupabase.from('businesses').select('*').eq('organization_id', org).is('deleted_at', null),
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
    const businesses = unwrap(12);
    const usersById = Object.fromEntries(users.map((user: RecordMap) => [user.id, user]));
    const partnersById = Object.fromEntries(partners.map((partner: RecordMap) => [partner.id, partner]));
    const businessesById = Object.fromEntries(businesses.map((business: RecordMap) => [business.id, business]));
    const offers = rawOffers.map((offer: RecordMap) => ({ ...offer, funding_partners: partnersById[offer.funding_partner_id] }));
    const renewals = rawRenewals.map((renewal: RecordMap) => ({ ...renewal, user_profiles: usersById[renewal.assigned_user_id] }));
    const deals = rawDeals.map((deal: RecordMap) => ({
      ...deal,
      businesses: businessesById[deal.business_id],
      user_profiles: usersById[deal.assigned_user_id],
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
      activities: unwrap(7),
      documents: unwrap(8),
      notes: unwrap(9),
      currentPositions: unwrap(10),
      dealFinancials: unwrap(11),
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
      <CrmTopbar title={title} subtitle="Loading broker workspace..." />
      <div className="grid gap-4 p-5 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[8px] bg-[#E2E8F0]" />)}
      </div>
    </div>
  );
}

function PageFrame({ title, subtitle, actions, children }: { title: string; subtitle: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar title={title} subtitle={subtitle} actions={actions} />
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 md:p-5">
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
  const repData = users.filter((user: RecordMap) => user.role !== 'client').slice(0, 6).map((user: RecordMap) => ({
    name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
    deals: deals.filter((deal: RecordMap) => deal.assigned_user_id === user.id).length,
    funded: deals.filter((deal: RecordMap) => deal.assigned_user_id === user.id).reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0),
  }));
  const attention = deals.filter((deal: RecordMap) => ['documents_requested', 'underwriting_review', 'contract_sent'].includes(deal.stage_slug)).slice(0, 6);

  return (
    <PageFrame title="Executive Dashboard" subtitle="MCA pipeline, production, renewals, and earnings at a glance">
      {error && <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total Leads" value={leads.length} subtitle="All active lead records" icon={<Users className="h-4 w-4" />} />
        <MetricCard title="Active Deals" value={activeDeals.length} subtitle="Open funding pipeline" icon={<Briefcase className="h-4 w-4" />} tone="#2563EB" />
        <MetricCard title="Deals Funded" value={fundedDeals.length} subtitle="Closed funded deals" icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" />
        <MetricCard title="Total Funded Volume" value={currency(totalFunded)} subtitle="Lifetime funded volume" icon={<TrendingUp className="h-4 w-4" />} tone="#0F766E" />
        <MetricCard title="Pending Offers" value={pendingOffers} subtitle="Received or presented" icon={<FileText className="h-4 w-4" />} tone="#D97706" />
        <MetricCard title="Approval Rate" value={pct(approvalRate)} subtitle="Offer-or-better conversion" icon={<Percent className="h-4 w-4" />} tone="#7C3AED" />
        <MetricCard title="Renewal Opportunities" value={renewals.length} subtitle="Tracked renewal records" icon={<RefreshCw className="h-4 w-4" />} tone="#0891B2" />
        <MetricCard title="Estimated Earnings" value={currency(estimatedEarnings)} subtitle="Gross commission booked" icon={<WalletCards className="h-4 w-4" />} tone="#C9A84C" />
        <MetricCard title="Paid Earnings" value={currency(paidEarnings)} subtitle="Commission received" icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" />
        <MetricCard title="Needs Attention" value={attention.length} subtitle="Docs, UW, or contracts" icon={<AlertTriangle className="h-4 w-4" />} tone="#DC2626" />
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
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#4F46E5" />
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
  const [priority, setPriority] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecordMap | null>(null);
  const [form, setForm] = useState<RecordMap>(emptyLead);
  if (loading) return <LoadingScreen title="Leads" />;

  const filtered = leads.filter((lead: RecordMap) => {
    const query = normalize(search);
    const statusMatch = status === 'all' || lead.status === status;
    const priorityMatch = priority === 'all' || (lead.priority || 'normal') === priority;
    const text = normalize([lead.business_name, lead.first_name, lead.last_name, lead.email, lead.phone, lead.lead_source].filter(Boolean).join(' '));
    return statusMatch && priorityMatch && (!query || text.includes(query));
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
    const result = editing
      ? await supabase.from('leads').update(payload).eq('id', editing.id)
      : await supabase.from('leads').insert(payload);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(editing ? 'Lead updated' : 'Lead created');
      setDialogOpen(false);
      reload();
    }
  };

  const convertLead = async (lead: RecordMap) => {
    const { error } = await supabase.from('deals').insert({
      organization_id: organizationId,
      lead_id: lead.id,
      title: lead.business_name || `${lead.first_name} ${lead.last_name}`.trim() || 'New deal',
      requested_amount: Number(lead.requested_amount || 0) || null,
      stage_slug: 'verification',
      assigned_user_id: lead.assigned_user_id || null,
    });
    if (error) toast.error(error.message);
    else {
      await supabase.from('leads').update({ status: 'converted' }).eq('id', lead.id);
      toast.success('Lead converted to deal');
      reload();
    }
  };

  return (
    <PageFrame title="Leads" subtitle="Search, qualify, assign, and convert MCA leads" actions={<Button className="h-9 rounded-[7px] bg-[#4F46E5] hover:bg-[#4338CA]" onClick={() => openLead()}><Plus className="mr-2 h-4 w-4" />Create Lead</Button>}>
      <CrmCard>
        <div className="flex flex-col gap-2 border-b border-[#E2E8F0] p-3 xl:flex-row xl:items-center">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by Name, Company, Phone Number or Email" className="h-9 flex-1 rounded-[4px] border-[#D7DCE5] text-[12px]" />
          <Button className="h-9 rounded-[4px] bg-white text-[#334155] shadow-none ring-1 ring-[#D7DCE5] hover:bg-[#F8FAFC]" onClick={() => setSearch(search.trim())}>Search</Button>
          <Button variant="outline" className="h-9 rounded-[4px]" onClick={() => { setSearch(''); setStatus('all'); setPriority('all'); }}>Clear</Button>
          <Button variant="outline" className="h-9 rounded-[4px]">Last 30 Days</Button>
          <Button variant="outline" className="h-9 rounded-[4px]">All Timezones</Button>
          <Select value={priority} onValueChange={setPriority}><SelectTrigger className="h-9 w-[128px] rounded-[4px]"><SelectValue placeholder="Priority" /></SelectTrigger><SelectContent><SelectItem value="all">Priority</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 w-[132px] rounded-[4px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Status</SelectItem>{['new', 'contacted', 'qualified', 'application_started', 'converted', 'lost', 'unresponsive'].map((item) => <SelectItem key={item} value={item}>{stageLabel(item)}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-[12px]">
            <thead className="border-b bg-white text-[11px] text-[#64748B]"><tr>{['Status', 'Company', 'Name', 'Phone Number', 'Email', 'Notes', 'Lead Source', 'Date & Time', 'Qualified', 'Actions'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filtered.map((lead: RecordMap) => (
                <tr key={lead.id} className="h-11 hover:bg-[#FAFBFF]">
                  <td className="px-4 py-2"><StatusBadge value={lead.status} /></td>
                  <td className="px-4 py-2 font-semibold text-[#0F172A]">{lead.business_name || 'No company'}</td>
                  <td className="px-4 py-2">{[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown'}</td>
                  <td className="px-4 py-2">{lead.phone || '—'}</td>
                  <td className="px-4 py-2">{lead.email || '—'}</td>
                  <td className="max-w-[220px] truncate px-4 py-2">{lead.notes || '—'}</td>
                  <td className="px-4 py-2 capitalize">{(lead.lead_source || 'manual').replaceAll('_', ' ')}</td>
                  <td className="px-4 py-2 text-[#64748B]">{date(lead.created_at)}</td>
                  <td className="px-4 py-2">{lead.status === 'qualified' || lead.status === 'converted' ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2"><div className="flex gap-2"><Button variant="outline" size="sm" className="h-7 rounded-[4px]" onClick={() => openLead(lead)}>Edit</Button><Button variant="outline" size="sm" className="h-7 rounded-[4px]" onClick={() => convertLead(lead)}>Convert</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <EmptyState title="No Leads" body="Create a lead or clear filters to show matching lead records." />}
        </div>
      </CrmCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl rounded-[8px]">
          <DialogHeader><DialogTitle>{editing ? 'Edit lead' : 'Create Lead'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Business name', 'business_name'],
              ['Contact first name', 'first_name'],
              ['Contact last name', 'last_name'],
              ['Phone', 'phone'],
              ['Email', 'email'],
              ['Requested amount', 'requested_amount'],
            ].map(([label, key]) => (<div key={key}><Label className="text-xs text-[#64748B]">{label}</Label><Input value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 rounded-[7px]" /></div>))}
            <div><Label className="text-xs text-[#64748B]">Status</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent>{['new', 'contacted', 'qualified', 'application_started', 'converted', 'lost', 'unresponsive'].map((item) => <SelectItem key={item} value={item}>{stageLabel(item)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs text-[#64748B]">Assigned rep</Label><Select value={form.assigned_user_id || 'unassigned'} onValueChange={(value) => setForm({ ...form, assigned_user_id: value === 'unassigned' ? '' : value })}><SelectTrigger className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{users.filter((user: RecordMap) => user.role !== 'client').map((user: RecordMap) => <SelectItem key={user.id} value={user.id}>{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</SelectItem>)}</SelectContent></Select></div>
            <div className="md:col-span-2"><Label className="text-xs text-[#64748B]">Internal notes</Label><Textarea value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-[96px] rounded-[7px]" /></div>
          </div>
          <DialogFooter><Button onClick={saveLead} className="rounded-[7px] bg-[#4F46E5]">Save lead</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}

function ProgressCell({ value }: { value: number }) {
  return <div className="min-w-[120px]"><div className="mb-1 flex items-center justify-between text-[11px] text-[#64748B]"><span>Stage Level</span><span>{value}%</span></div><div className="h-1.5 rounded-full bg-[#E2E8F0]"><div className="h-1.5 rounded-full bg-[#4F46E5]" style={{ width: `${value}%` }} /></div></div>;
}

function DealTable({ rows, approvedNotAccepted = false, onReactivate }: { rows: RecordMap[]; approvedNotAccepted?: boolean; onReactivate?: (deal: RecordMap) => void }) {
  if (approvedNotAccepted) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-[12px]">
          <thead className="border-b bg-white text-[11px] text-[#64748B]"><tr>{['Merchant', 'Approved amount', 'Offer date', 'Funding partner', 'Reason not accepted', 'Follow-up date', 'Assigned user', 'Last activity', 'Actions'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {rows.map((deal) => { const offer = Array.isArray(deal.offers) ? deal.offers[0] : {}; return <tr key={deal.id} className="h-11 hover:bg-[#FAFBFF]"><td className="px-4 py-2"><Link href={`/crm/deals/${deal.id}`} className="font-semibold text-[#4338CA]">{businessName(deal)}</Link></td><td className="px-4 py-2 font-semibold">{currency(offer?.approved_amount || deal.approved_amount)}</td><td className="px-4 py-2">{date(offer?.created_at || deal.updated_at)}</td><td className="px-4 py-2">{offer?.funding_partners?.name || partnerName(deal)}</td><td className="px-4 py-2"><StatusBadge value={deal.not_accepted_reason || 'No response'} /></td><td className="px-4 py-2">{date(deal.follow_up_date)}</td><td className="px-4 py-2">{repName(deal)}</td><td className="px-4 py-2 text-[#64748B]">{date(deal.updated_at)}</td><td className="px-4 py-2"><Button variant="outline" size="sm" className="h-7 rounded-[4px]" onClick={() => onReactivate?.(deal)}>Reopen</Button></td></tr>; })}
          </tbody>
        </table>
        {!rows.length && <EmptyState title="No approved but not accepted deals" body="Approved offers that merchants did not accept will remain separated here." />}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1320px] text-left text-[12px]">
        <thead className="border-b bg-white text-[11px] text-[#64748B]"><tr>{['Deal Name / Business Name', 'Amount', 'Stage', 'Stage Level / Progress %', 'Name / Contact', 'Information', 'Phone', 'Email', 'Status', 'Funding Partner', 'Last Activity'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {rows.map((deal) => {
            const offer = Array.isArray(deal.offers) ? deal.offers[0] : null;
            const renewal = Array.isArray(deal.renewals) ? deal.renewals[0] : null;
            const progress = stageProgress(deal.stage_slug);
            return (
              <tr key={deal.id} className="h-11 hover:bg-[#FAFBFF]">
                <td className="px-4 py-2"><Link href={`/crm/deals/${deal.id}`} className="font-semibold text-[#4338CA]">{businessName(deal)}</Link><p className="text-[11px] text-[#94A3B8]">{shortId(deal.id)}</p></td>
                <td className="px-4 py-2 font-semibold">{currency(deal.requested_amount || offer?.approved_amount || deal.funded_amount)}</td>
                <td className="px-4 py-2"><StatusBadge value={dealStageKey(deal)} /></td>
                <td className="px-4 py-2"><ProgressCell value={progress} /></td>
                <td className="px-4 py-2">{deal.businesses?.contact_name || deal.businesses?.owner_name || 'Merchant Contact'}</td>
                <td className="max-w-[220px] truncate px-4 py-2">{deal.notes || renewal?.notes || 'MCA funding opportunity'}</td>
                <td className="px-4 py-2">{deal.businesses?.phone || '—'}</td>
                <td className="px-4 py-2">{deal.businesses?.email || '—'}</td>
                <td className="px-4 py-2"><StatusBadge value={dealStageKey(deal)} /></td>
                <td className="px-4 py-2">{offer?.funding_partners?.name || partnerName(deal)}</td>
                <td className="px-4 py-2 text-[#64748B]">{date(deal.updated_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <EmptyState title="No deals found" body="Adjust filters or create a deal to start building the MCA pipeline." />}
    </div>
  );
}

export function CrmDealsExperience() {
  const { deals, organizationId, loading, reload } = useCrmDataset();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dealTitle, setDealTitle] = useState('');
  const [dealAmount, setDealAmount] = useState('');
  if (loading) return <LoadingScreen title="Deals" />;

  const approvedNotAccepted = deals.filter((deal: RecordMap) => dealStageKey(deal) === 'approved_not_accepted');
  const renewalAlerts = deals.filter((deal: RecordMap) => {
    const renewal = Array.isArray(deal.renewals) ? deal.renewals[0] : undefined;
    return (dealStageKey(deal) === 'funded' || dealStageKey(deal) === 'renewal_eligible') && renewalMetrics(deal, renewal).eligible;
  });
  const filtered = deals.filter((deal: RecordMap) => {
    const query = normalize(search);
    const statusMatch = stage === 'all' || (stage === 'approved_not_accepted' ? dealStageKey(deal) === 'approved_not_accepted' : dealStageKey(deal) === stage || deal.stage_slug === stage);
    const text = normalize([deal.id, businessName(deal), deal.businesses?.phone, deal.businesses?.email, repName(deal), partnerName(deal), deal.stage_slug].join(' '));
    return statusMatch && (!query || text.includes(query));
  });

  const saveDeal = async () => {
    const { error } = await supabase.from('deals').insert({ organization_id: organizationId, title: dealTitle || 'New Deal', requested_amount: Number(dealAmount || 0) || null, stage_slug: 'verification' });
    if (error) toast.error(error.message); else { toast.success('Deal created'); setDialogOpen(false); setDealTitle(''); setDealAmount(''); reload(); }
  };

  const reactivate = async (deal: RecordMap) => {
    const { error } = await supabase.from('deals').update({ stage_slug: 'working_deal', updated_at: new Date().toISOString() }).eq('id', deal.id);
    if (error) toast.error(error.message); else { toast.success('Deal reopened as Working Deal'); reload(); }
  };

  return (
    <PageFrame title="Deals" subtitle="MCA pipeline with stage summaries, renewal alerts, and separated approved-not-accepted offers" actions={<Button className="h-9 rounded-[7px] bg-[#4F46E5] hover:bg-[#4338CA]" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Create Deal</Button>}>
      {!!renewalAlerts.length && <div className="mb-3 rounded-[8px] border border-purple-200 bg-purple-50 p-3 text-sm text-purple-800"><b>{renewalAlerts.length} renewal opportunity alert{renewalAlerts.length === 1 ? '' : 's'}:</b> funded merchants meet the default {RENEWAL_PAID_DOWN_THRESHOLD}% paid-down or {RENEWAL_DAYS_THRESHOLD}-day threshold.</div>}
      <div className="mb-3 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {PIPELINE_SUMMARY_STAGES.map((item) => { const stageDeals = deals.filter((deal: RecordMap) => item.aliases.includes(dealStageKey(deal)) || item.aliases.includes(deal.stage_slug)); const total = stageDeals.reduce((sum: number, deal: RecordMap) => sum + Number(deal.requested_amount || deal.approved_amount || deal.funded_amount || 0), 0); return <button key={item.value} onClick={() => setStage(item.value)} className={`rounded-[8px] border bg-white p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${stage === item.value ? 'border-[#4F46E5] ring-1 ring-[#4F46E5]' : 'border-[#E2E8F0]'}`}><p className="truncate text-[11px] font-semibold text-[#64748B]">{item.label}</p><p className="mt-1 text-lg font-semibold text-[#0F172A]">{stageDeals.length}</p><p className="text-[11px] text-[#64748B]">{currency(total)}</p></button>; })}
      </div>
      <CrmCard>
        <div className="flex flex-col gap-2 border-b border-[#E2E8F0] p-3 xl:flex-row xl:items-center">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, company, phone number, or email" className="h-9 flex-1 rounded-[4px] border-[#D7DCE5] text-[12px]" />
          <Select value={stage} onValueChange={setStage}><SelectTrigger className="h-9 w-[210px] rounded-[4px]"><SelectValue placeholder="Deal Status" /></SelectTrigger><SelectContent><SelectItem value="all">Deal Status</SelectItem>{STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" className="h-9 rounded-[4px]">Last 30 Days</Button>
          <Button variant="outline" className="h-9 rounded-[4px]">Sort Newest</Button>
          <Button variant="outline" className="h-9 rounded-[4px]" onClick={() => { setSearch(''); setStage('all'); }}>Clear</Button>
          <Button variant="outline" className="h-9 rounded-[4px]" onClick={() => exportCsv('deals', filtered)}><Download className="mr-2 h-4 w-4" />CSV</Button>
        </div>
        <Tabs value={stage === 'approved_not_accepted' ? 'approved_not_accepted' : 'pipeline'} onValueChange={(value) => setStage(value === 'pipeline' ? 'all' : value)}>
          <TabsList className="m-3 mb-0 h-9 rounded-[6px] bg-[#F1F5F9]"><TabsTrigger value="pipeline">Pipeline</TabsTrigger><TabsTrigger value="approved_not_accepted">Approved but Not Accepted ({approvedNotAccepted.length})</TabsTrigger></TabsList>
          <TabsContent value="pipeline" className="mt-0"><DealTable rows={filtered.filter((deal: RecordMap) => dealStageKey(deal) !== 'approved_not_accepted')} /></TabsContent>
          <TabsContent value="approved_not_accepted" className="mt-0"><DealTable rows={(stage === 'approved_not_accepted' ? filtered : approvedNotAccepted)} approvedNotAccepted onReactivate={reactivate} /></TabsContent>
        </Tabs>
      </CrmCard>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="rounded-[8px]"><DialogHeader><DialogTitle>Create Deal</DialogTitle></DialogHeader><div className="grid gap-3"><div><Label>Deal Name / Business Name</Label><Input value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} /></div><div><Label>Amount</Label><Input value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} /></div></div><DialogFooter><Button onClick={saveDeal} className="bg-[#4F46E5]">Create Deal</Button></DialogFooter></DialogContent></Dialog>
    </PageFrame>
  );
}

export function CrmDealDetailExperience({ dealId }: { dealId: string }) {
  const { deals, offers, documents, activities, notes, renewals, currentPositions, dealFinancials, loading } = useCrmDataset();
  if (loading) return <LoadingScreen title="Deal Detail" />;
  const deal = deals.find((row: RecordMap) => row.id === dealId) || deals[0];
  if (!deal) return <PageFrame title="Deal Detail" subtitle="No deal selected"><EmptyState title="Deal not found" body="The requested deal could not be loaded." /></PageFrame>;
  const dealOffers = offers.filter((offer: RecordMap) => offer.deal_id === deal.id);
  const dealDocs = documents.filter((doc: RecordMap) => doc.deal_id === deal.id || doc.application_id === deal.application_id);
  const dealRenewals = renewals.filter((renewal: RecordMap) => renewal.original_deal_id === deal.id);
  const financial = dealFinancials.find((row: RecordMap) => row.deal_id === deal.id) || {};
  const positions = currentPositions.filter((row: RecordMap) => row.deal_id === deal.id || row.business_id === deal.business_id);
  const offer = dealOffers[0] || {};
  const renewal = dealRenewals[0];
  const renewalCalc = renewalMetrics(deal, renewal, financial, offer);
  const currentBalance = renewalCalc.balance;
  const percentPaid = renewalCalc.percentPaid;

  return (
    <PageFrame title={businessName(deal)} subtitle={`Deal ${shortId(deal.id)} · ${stageLabel(deal.stage_slug)}`} actions={<div className="flex items-center gap-2"><Button className="h-9 rounded-[7px] bg-[#4F46E5] hover:bg-[#4338CA]">{dealStageKey(deal) === 'funded' ? 'Create Renewal' : 'Move Stage'}</Button><Link href="/crm/deals" className="text-sm font-semibold text-[#0F2B5B]">Back to deals</Link></div>}>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard title="Requested" value={currency(deal.requested_amount)} subtitle="Merchant ask" icon={<Target className="h-4 w-4" />} />
        <MetricCard title="Best Offer" value={currency(offer.approved_amount || deal.approved_amount)} subtitle={`${offer.factor_rate || 'N/A'} factor`} icon={<FileText className="h-4 w-4" />} tone="#2563EB" />
        <MetricCard title="Funded" value={currency(deal.funded_amount)} subtitle={date(deal.funded_at)} icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" />
        <MetricCard title="Current Balance" value={currency(currentBalance)} subtitle={`${pct(percentPaid)} paid down`} icon={<WalletCards className="h-4 w-4" />} tone="#D97706" />
      </div>

      <CrmCard className="p-4">
        <Tabs defaultValue="info">
          <TabsList className="mb-4 flex h-auto flex-wrap justify-start rounded-[8px] bg-[#F1F5F9] p-1">
            {['info', 'documents', 'files', 'notes', 'interview', 'financials', 'merchant', 'positions', 'renewals'].map((tab) => <TabsTrigger key={tab} value={tab} className="rounded-[6px] capitalize">{tab === 'info' ? 'Deal Info' : tab === 'interview' ? 'Merchant Interview' : tab === 'positions' ? 'Current Positions' : tab}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="info"><InfoGrid rows={[['Deal amount', currency(deal.requested_amount || deal.funded_amount)], ['Stage', stageLabel(dealStageKey(deal))], ['Status', <StatusBadge key="status" value={dealStageKey(deal)} />], ['Assigned user', repName(deal)], ['Source', deal.lead_id ? 'Lead conversion' : deal.application_id ? 'Application' : 'Manual entry'], ['Funding partner', partnerName(offer)], ['Created date', date(deal.created_at)], ['Updated date', date(deal.updated_at)], ['Notes/activity', deal.notes || 'No recent notes']]} /></TabsContent>
          <TabsContent value="financials"><InfoGrid rows={[['Gross monthly revenue', currency(deal.businesses?.monthly_gross_revenue)], ['Average bank balance', currency(financial.average_bank_balance || deal.application?.ending_balance_estimate)], ['Deposits', currency(financial.avg_monthly_deposits)], ['NSF count', financial.nsf_count ?? '—'], ['Requested amount', currency(deal.requested_amount)], ['Approved amount', currency(offer.approved_amount || deal.approved_amount)], ['Funded amount', currency(deal.funded_amount)], ['Factor rate', offer.factor_rate || financial.factor_rate || '—'], ['Payback amount', currency(offer.payback_amount || financial.total_payback)], ['Payment amount', currency(offer.daily_payment || offer.weekly_payment || financial.daily_payment || financial.weekly_payment)], ['Term', `${offer.term_days || financial.remaining_term_days || '—'} days`], ['Commission', currency(offer.commission_amount || financial.commission_amount)]]} /></TabsContent>
          <TabsContent value="merchant"><InfoGrid rows={[['Company background', deal.businesses?.description || 'Background not entered'], ['Legal business name', deal.businesses?.legal_name || businessName(deal)], ['DBA', deal.businesses?.dba || 'None'], ['Business address', [deal.businesses?.address_line1 || deal.businesses?.address, deal.businesses?.city, deal.businesses?.state, deal.businesses?.zip].filter(Boolean).join(', ') || 'Unknown'], ['Owner info', deal.businesses?.contact_name || 'Masked / not entered'], ['Email', deal.businesses?.email || 'Unknown'], ['Phone', deal.businesses?.phone || 'Unknown'], ['EIN masked', masked(deal.businesses?.ein || deal.businesses?.tax_id)], ['Industry', deal.businesses?.industry || 'Unknown'], ['Time in business', deal.businesses?.time_in_business || deal.businesses?.years_in_business || 'Unknown']]} /></TabsContent>
          <TabsContent value="positions"><div className="overflow-x-auto rounded-[8px] border border-[#E2E8F0]"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr>{['Funder/lender','Advance amount','Payment amount','Balance','Frequency','Start date','Estimated payoff','Status','Notes'].map((head) => <th key={head} className="px-3 py-2">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{positions.map((row) => <tr key={row.id}><td className="px-3 py-2 font-semibold">{row.funder_name}</td><td className="px-3 py-2">{currency(row.original_funded_amount)}</td><td className="px-3 py-2">{currency(row.daily_payment || row.weekly_payment)}</td><td className="px-3 py-2">{currency(row.current_balance)}</td><td className="px-3 py-2 capitalize">{row.payment_frequency || '—'}</td><td className="px-3 py-2">{date(row.created_at)}</td><td className="px-3 py-2">{date(row.estimated_payoff_date)}</td><td className="px-3 py-2"><StatusBadge value={row.status || 'active'} /></td><td className="px-3 py-2">{row.notes || '—'}</td></tr>)}</tbody></table>{!positions.length && <EmptyState title="No current positions tracked." body="MCA positions and payoff notes will appear here." />}</div></TabsContent>
          <TabsContent value="interview"><InfoGrid rows={[['Interview status', deal.interview_status || 'Not started'], ['Merchant notes', deal.merchant_interview_notes || deal.notes || 'No interview notes'], ['Best callback', deal.best_callback_time || 'Not set']]} /></TabsContent><TabsContent value="files"><SimpleRows rows={dealDocs} empty="No files attached." render={(row) => <div className="grid gap-2 md:grid-cols-5"><b>{row.label || row.file_name}</b><span>{row.document_type}</span><span>{row.file_name}</span><StatusBadge value={row.status} /><span>{date(row.created_at)}</span></div>} /></TabsContent>
          <TabsContent value="documents"><SimpleRows rows={dealDocs} empty="No documents attached." render={(row) => <div className="grid gap-2 md:grid-cols-5"><b>{row.label || row.file_name}</b><span>{row.document_type}</span><span>{row.file_name}</span><StatusBadge value={row.status} /><span>{date(row.created_at)}</span></div>} /></TabsContent>
          <TabsContent value="activity"><SimpleRows rows={activities.filter((row: RecordMap) => row.deal_id === deal.id || row.resource_id === deal.id).slice(0, 12)} empty="No activity yet." render={(row) => <div><b>{row.title || row.action || 'Activity'}</b><p className="text-xs text-[#64748B]">{date(row.created_at)}</p></div>} /></TabsContent>
          <TabsContent value="notes"><SimpleRows rows={notes.filter((row: RecordMap) => row.deal_id === deal.id || row.application_id === deal.application_id)} empty="No notes yet." render={(row) => <div><b>{row.is_internal ? 'Internal note' : 'Shared note'}</b><p className="text-[#334155]">{row.body || row.note}</p><p className="text-xs text-[#64748B]">{date(row.created_at)}</p></div>} /></TabsContent>
          <TabsContent value="renewals">
            <InfoGrid rows={[
              ['Funded date', date(deal.funded_at)],
              ['Funded amount', currency(deal.funded_amount)],
              ['Total payback', currency(offer.payback_amount || financial.total_payback)],
              ['Current balance', currency(currentBalance)],
              ['Percent paid down', pct(percentPaid)],
              ['Balance remaining', currency(currentBalance)],
              ['Time since funded', `${renewalCalc.daysSinceFunded} days`],
              ['Time remaining', `${financial.remaining_term_days || offer.term_days || 0} days`],
              ['Estimated payoff date', date(financial.estimated_payoff_date || dealRenewals[0]?.renewal_date)],
              ['Renewal eligibility date', date(dealRenewals[0]?.renewal_date || deal.funded_at)],
              ['Renewal status', <StatusBadge key="renewal-status" value={renewalCalc.status} />],
              ['Assigned rep', repName(dealRenewals[0] || deal)],
              ['Funding partner', partnerName(offer)],
              ['Renewal notes', dealRenewals[0]?.notes || 'Monitor paydown and recent deposits.'],
              ['Alert flags', (dealRenewals[0]?.alert_flags || financial.alert_flags || ['Paydown watch']).join(', ')],
            ]} />
          </TabsContent>
        </Tabs>
      </CrmCard>
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
  const [status, setStatus] = useState('all');
  if (loading) return <LoadingScreen title="Earnings" />;
  const filtered = commissions.filter((row: RecordMap) => {
    const statusMatch = status === 'all' || row.payment_status === status;
    const text = normalize([businessName(row.deals || {}), repName(row), partnerName(row.offers || {}), row.payment_status, row.notes].join(' '));
    return statusMatch && text.includes(normalize(search));
  });
  const total = filtered.reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0);
  const paid = filtered.filter((row: RecordMap) => row.payment_status === 'paid').reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0);
  const pending = total - paid;
  const byUser = Object.entries(filtered.reduce<Record<string, number>>((acc, row: RecordMap) => { const name = repName(row); acc[name] = (acc[name] || 0) + Number(row.commission_amount || 0); return acc; }, {})).slice(0, 4);
  const byMonth = Object.entries(filtered.reduce<Record<string, number>>((acc, row: RecordMap) => { const month = new Date(row.created_at || row.paid_date || Date.now()).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); acc[month] = (acc[month] || 0) + Number(row.commission_amount || 0); return acc; }, {})).slice(0, 4);
  return (
    <PageFrame title="Earnings" subtitle="Date, user, status, and funding partner commission reporting">
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard title="Total earnings" value={currency(total)} subtitle="All booked earnings" icon={<WalletCards className="h-4 w-4" />} />
        <MetricCard title="Pending earnings" value={currency(pending)} subtitle="Pending, available, held, or chargeback" icon={<CalendarClock className="h-4 w-4" />} tone="#D97706" />
        <MetricCard title="Paid earnings" value={currency(paid)} subtitle="Paid to reps" icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" />
        <MetricCard title="Earnings by user" value={byUser[0] ? currency(byUser[0][1]) : '$0'} subtitle={byUser[0]?.[0] || 'No user data'} icon={<Users className="h-4 w-4" />} tone="#2563EB" />
        <MetricCard title="Earnings by month" value={byMonth[0] ? currency(byMonth[0][1]) : '$0'} subtitle={byMonth[0]?.[0] || 'No month data'} icon={<BarChart3 className="h-4 w-4" />} tone="#7C3AED" />
      </div>
      <CrmCard>
        <div className="flex flex-col gap-2 border-b border-[#E2E8F0] p-3 xl:flex-row xl:items-center">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search earnings by deal, user, funding partner, or notes" className="h-9 flex-1 rounded-[4px] text-[12px]" />
          <Button variant="outline" className="h-9 rounded-[4px]">Date filters</Button>
          <Button variant="outline" className="h-9 rounded-[4px]">User filter</Button>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 w-[160px] rounded-[4px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Status filter</SelectItem>{['pending','available','paid','held','chargeback'].map((item) => <SelectItem key={item} value={item}>{stageLabel(item)}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" className="h-9 rounded-[4px]">Funding partner</Button>
          <Button variant="outline" className="h-9 rounded-[4px]" onClick={() => exportCsv('earnings', filtered)}><Download className="mr-2 h-4 w-4" />CSV</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-[12px]">
            <thead className="border-b bg-white text-[11px] text-[#64748B]"><tr>{['Date', 'Deal', 'User', 'Type', 'Amount', 'Available', 'Status', 'Paid To', 'Notes'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#E2E8F0]">{filtered.map((row: RecordMap) => <tr key={row.id} className="h-11 hover:bg-[#FAFBFF]"><td className="px-4 py-2">{date(row.created_at)}</td><td className="px-4 py-2 font-semibold">{businessName(row.deals || {})}</td><td className="px-4 py-2">{repName(row)}</td><td className="px-4 py-2">Commission</td><td className="px-4 py-2 font-semibold">{currency(row.commission_amount)}</td><td className="px-4 py-2">{date(row.available_at || row.paid_date)}</td><td className="px-4 py-2"><StatusBadge value={row.payment_status || 'pending'} /></td><td className="px-4 py-2">{row.paid_to || repName(row)}</td><td className="max-w-[240px] truncate px-4 py-2">{row.notes || partnerName(row.offers || {})}</td></tr>)}</tbody>
          </table>
          {!filtered.length && <EmptyState title="No earnings" body="Earnings will populate as funded deals and commissions are booked." />}
        </div>
      </CrmCard>
    </PageFrame>
  );
}

export function CrmReportsExperience() {
  const { leads, deals, offers, renewals, commissions, partners, users, loading } = useCrmDataset();
  if (loading) return <LoadingScreen title="Reports" />;
  const conversion = [
    { name: 'Lead volume', value: leads.length },
    { name: 'Submissions', value: deals.filter((row: RecordMap) => ['application_submitted', 'underwriting_review', 'offers_received', 'offer_presented', 'contract_sent', 'contract_signed', 'funded'].includes(row.stage_slug)).length },
    { name: 'Offers', value: offers.length },
    { name: 'Funded', value: deals.filter((row: RecordMap) => row.stage_slug === 'funded' || row.funded_at).length },
    { name: 'Renewals', value: renewals.length },
  ];
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - index));
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    return { month, funded: deals.filter((deal: RecordMap) => new Date(deal.funded_at || deal.created_at).getMonth() === d.getMonth()).reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0) };
  });
  const reportRows = [
    ['Lead volume', leads.length, 'CSV / Excel / PDF'],
    ['Submission volume', conversion[1].value, 'CSV / Excel / PDF'],
    ['Approval rate', deals.length ? pct((offers.length / deals.length) * 100) : '0%', 'CSV / Excel / PDF'],
    ['Offer rate', deals.length ? pct((offers.length / deals.length) * 100) : '0%', 'CSV / Excel / PDF'],
    ['Funded volume', currency(monthly.reduce((sum, row) => sum + row.funded, 0)), 'CSV / Excel / PDF'],
    ['Renewal pipeline', renewals.length, 'CSV / Excel / PDF'],
    ['Rep performance', users.length, 'CSV / Excel / PDF'],
    ['Funding partner performance', partners.length, 'CSV / Excel / PDF'],
    ['Earnings report', currency(commissions.reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0)), 'CSV'],
    ['Deal report', deals.length, 'CSV'],
    ['Funding report', currency(deals.reduce((sum: number, row: RecordMap) => sum + Number(row.funded_amount || 0), 0)), 'CSV'],
    ['Approved but not accepted report', deals.filter((row: RecordMap) => dealStageKey(row) === 'approved_not_accepted').length, 'CSV'],
  ];
  return (
    <PageFrame title="Reports" subtitle="Date-filtered MCA production, rep, partner, renewal, and earnings reports" actions={<div className="flex flex-wrap gap-2"><Button variant="outline" className="h-9 rounded-[7px]"><Filter className="mr-2 h-4 w-4" />Date range</Button><Button variant="outline" className="h-9 rounded-[7px]">User</Button><Button variant="outline" className="h-9 rounded-[7px]">Status</Button><Button variant="outline" className="h-9 rounded-[7px]">Stage</Button><Button variant="outline" className="h-9 rounded-[7px]">Funding partner</Button><Button className="h-9 rounded-[7px] bg-[#4F46E5]"><Download className="mr-2 h-4 w-4" />Export CSV</Button></div>}>
      <div className="grid gap-4 xl:grid-cols-2">
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Pipeline Conversion</h2><ResponsiveContainer width="100%" height={290}><BarChart data={conversion}><CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#4F46E5" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></CrmCard>
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Funded Volume Trend</h2><ResponsiveContainer width="100%" height={290}><LineChart data={monthly}><CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => currency(value)} /><Line type="monotone" dataKey="funded" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></CrmCard>
      </div>
      <CrmCard className="mt-4 overflow-hidden">
        <table className="w-full text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">Report</th><th className="px-4 py-3">Current value</th><th className="px-4 py-3">Exports</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-[#E2E8F0]">{reportRows.map(([name, value, exports]) => <tr key={name}><td className="px-4 py-3 font-semibold">{name}</td><td className="px-4 py-3">{value}</td><td className="px-4 py-3">{exports}</td><td className="px-4 py-3"><Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => toast.success(`${name} export prepared`)}>Export</Button></td></tr>)}</tbody></table>
      </CrmCard>
    </PageFrame>
  );
}

export function CrmToolsExperience() {
  const tools = [
    ['Advanced Deal Search', 'Search by merchant, owner, phone, email, stage, funded status, offer status, renewal status, funding partner, assigned user, amount range, and date range.', Search, '/crm/deals'],
    ['Advanced Earnings Search', 'Search by user, deal, funding partner, paid/unpaid status, date range, and commission amount range.', WalletCards, '/crm/earnings'],
    ['Renewal Search', 'Locate eligible merchants by paydown, payoff date, funding partner, and assigned rep.', RefreshCw, '/crm/renewals'],
    ['User Management', 'Create users, edit profiles, deactivate users, assign roles, assign records, and view performance.', Users, '/crm/users'],
    ['Permission Management', 'Control granular dashboard, lead, deal, financial, merchant, renewal, earnings, report, tools, document, and sensitive reveal permissions.', Shield, '/crm/users'],
    ['Funding Partner Management', 'Maintain funder criteria, contacts, offers, and product rules.', Building2, '/crm/partners'],
    ['Stage/Status Management', 'Review and adjust pipeline stages, statuses, and approved-not-accepted outcomes.', SlidersHorizontal, '/crm/pipeline'],
    ['Import/Export', 'Prepare CSV exports and import mapping for leads, deals, earnings, and renewals.', Database, '/crm/reports'],
    ['System Settings', 'Organization settings, renewal thresholds, security controls, and connected services.', Settings, '/crm/settings'],
  ];
  const dealFilters = ['Merchant name','Owner name','Phone','Email','Deal stage','Funded status','Offer status','Renewal status','Funding partner','Assigned user','Amount range','Date range'];
  const earningFilters = ['User','Deal','Funding partner','Paid/unpaid','Date range','Commission amount range'];
  return (
    <PageFrame title="Tools" subtitle="Advanced search, user operations, permissions, and CRM administration">
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Advanced Deal Search filters</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{dealFilters.map((filter) => <Input key={filter} placeholder={filter} className="h-9 rounded-[4px] text-[12px]" />)}</div></CrmCard>
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Advanced Earnings Search filters</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{earningFilters.map((filter) => <Input key={filter} placeholder={filter} className="h-9 rounded-[4px] text-[12px]" />)}</div></CrmCard>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tools.map(([title, body, Icon, href]: any) => (
          <Link key={title} href={href} className="rounded-[8px] border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-[#4F46E5] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#EEF2FF] text-[#4F46E5]"><Icon className="h-4 w-4" /></div>
            <h2 className="mt-4 text-sm font-semibold text-[#0F172A]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">{body}</p>
          </Link>
        ))}
      </div>
    </PageFrame>
  );
}

export function CrmRenewalsExperience() {
  const { renewals, deals, offers, dealFinancials, loading } = useCrmDataset();
  const [search, setSearch] = useState('');
  if (loading) return <LoadingScreen title="Renewals" />;
  const fundedDeals = deals.filter((deal: RecordMap) => ['funded', 'renewal_eligible'].includes(dealStageKey(deal)) || deal.funded_at);
  const rows = fundedDeals.map((deal: RecordMap) => {
    const renewal = renewals.find((row: RecordMap) => row.original_deal_id === deal.id);
    const financial = dealFinancials.find((row: RecordMap) => row.deal_id === deal.id) || {};
    const offer = offers.find((row: RecordMap) => row.deal_id === deal.id) || {};
    return { id: renewal?.id || deal.id, renewal, deal, financial, offer, metrics: renewalMetrics(deal, renewal, financial, offer) };
  }).filter((row: RecordMap) => normalize([businessName(row.deal), repName(row.deal), partnerName(row.offer), row.metrics.status].join(' ')).includes(normalize(search)));
  return (
    <PageFrame title="Renewals" subtitle={`Eligibility defaults: ${RENEWAL_PAID_DOWN_THRESHOLD}% paid down or ${RENEWAL_DAYS_THRESHOLD} days since funding; adjustable later in Settings`}>
      <CrmCard>
        <Toolbar search={search} setSearch={setSearch}><Button variant="outline" className="h-10 rounded-[7px]" onClick={() => exportCsv('renewals', rows)}><Download className="mr-2 h-4 w-4" />Export CSV</Button></Toolbar>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1420px] text-left text-[12px]"><thead className="border-b bg-white text-[11px] text-[#64748B]"><tr>{['Merchant','Funded date','Funded amount','Total payback','Current balance','Balance remaining','Percent paid down','Time since funded','Time remaining','Estimated payoff date','Renewal eligibility date','Renewal status','Renewal notes','Assigned rep','Funding partner'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{rows.map((row: RecordMap) => <tr key={row.id} className="h-11 hover:bg-[#FAFBFF]"><td className="px-4 py-2 font-semibold"><Link className="text-[#4338CA]" href={`/crm/deals/${row.deal.id}`}>{businessName(row.deal)}</Link></td><td className="px-4 py-2">{date(row.deal.funded_at || row.financial.funded_date)}</td><td className="px-4 py-2">{currency(row.metrics.fundedAmount)}</td><td className="px-4 py-2">{currency(row.metrics.payback)}</td><td className="px-4 py-2">{currency(row.metrics.balance)}</td><td className="px-4 py-2">{currency(row.metrics.balance)}</td><td className="px-4 py-2"><ProgressCell value={Math.round(row.metrics.percentPaid)} /></td><td className="px-4 py-2">{row.metrics.daysSinceFunded} days</td><td className="px-4 py-2">{row.financial.remaining_term_days || row.offer.term_days || '—'} days</td><td className="px-4 py-2">{date(row.financial.estimated_payoff_date || row.renewal?.renewal_date)}</td><td className="px-4 py-2">{date(row.renewal?.renewal_date || row.deal.funded_at)}</td><td className="px-4 py-2"><StatusBadge value={row.metrics.status} /></td><td className="max-w-[240px] truncate px-4 py-2">{row.renewal?.notes || 'Review latest bank statements before outreach.'}</td><td className="px-4 py-2">{repName(row.renewal || row.deal)}</td><td className="px-4 py-2">{partnerName(row.offer)}</td></tr>)}</tbody></table>
          {!rows.length && <EmptyState title="No renewals" body="Funded deals will appear here with calculated paydown and eligibility." />}
        </div>
      </CrmCard>
    </PageFrame>
  );
}

export function CrmUsersExperience() {
  const { users, deals, commissions, loading } = useCrmDataset();
  if (loading) return <LoadingScreen title="Users" />;
  const permissions = ['View Dashboard','View Leads','Create/Edit Leads','View Deals','Create/Edit Deals','View Deal Financials','View Merchant Info','View Current Positions','View Renewals','View Earnings','View Reports','View Tools','Manage Users','Manage Settings','View Documents','Delete Documents','Reveal Sensitive Data'];
  const roles = ['super_admin','admin','manager','sales_rep','processor','underwriter','viewer','client'];
  const allowed = (role: string, permission: string) => {
    if (role === 'client') return false;
    if (['super_admin','admin'].includes(role)) return true;
    if (role === 'viewer') return permission.startsWith('View') && permission !== 'View Earnings' && permission !== 'Reveal Sensitive Data';
    if (permission.includes('Manage') || permission === 'Delete Documents' || permission === 'Reveal Sensitive Data') return false;
    if (role === 'sales_rep' && permission === 'View Earnings') return true;
    return permission.startsWith('View') || permission.startsWith('Create/Edit');
  };
  return (
    <PageFrame title="User Management" subtitle="Create users, assign roles, control CRM visibility, and protect sensitive data" actions={<Button className="h-9 rounded-[7px] bg-[#4F46E5]"><Plus className="mr-2 h-4 w-4" />Create user</Button>}>
      <CrmCard className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-[12px]"><thead className="border-b bg-white text-[11px] text-[#64748B]"><tr>{['User','Role','Status','Deals','Funded volume','Earnings','Last login','Invite / Actions'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{users.map((user: RecordMap) => { const userDeals = deals.filter((deal: RecordMap) => deal.assigned_user_id === user.id); const userEarnings = commissions.filter((row: RecordMap) => row.rep_id === user.id).reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0); return <tr key={user.id} className="h-11 hover:bg-[#FAFBFF]"><td className="px-4 py-2"><p className="font-semibold">{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</p><p className="text-[11px] text-[#64748B]">{user.email}</p></td><td className="px-4 py-2 capitalize"><StatusBadge value={user.role?.replaceAll('_', ' ')} /></td><td className="px-4 py-2"><StatusBadge value={user.is_active ? 'active' : 'inactive'} /></td><td className="px-4 py-2">{userDeals.length}</td><td className="px-4 py-2">{currency(userDeals.reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0))}</td><td className="px-4 py-2">{currency(userEarnings)}</td><td className="px-4 py-2">{date(user.last_login_at)}</td><td className="px-4 py-2"><div className="flex gap-2"><Button variant="outline" size="sm" className="h-7 rounded-[4px]">Edit</Button><Button variant="outline" size="sm" className="h-7 rounded-[4px]">Send invite</Button><Button variant="outline" size="sm" className="h-7 rounded-[4px]">Deactivate</Button></div></td></tr>; })}</tbody></table>
      </CrmCard>
      <CrmCard className="overflow-x-auto p-4">
        <div className="mb-3"><h2 className="text-sm font-semibold text-[#0F172A]">Permission Management</h2><p className="text-xs text-[#64748B]">Only super_admin/admin can reveal sensitive fields. Viewers are read-only. Clients are excluded from CRM routes and stay in the portal.</p></div>
        <table className="w-full min-w-[1180px] text-left text-[12px]"><thead className="border-b bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr><th className="px-3 py-2">Permission</th>{roles.map((role) => <th key={role} className="px-3 py-2 capitalize">{role.replaceAll('_',' ')}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{permissions.map((permission) => <tr key={permission}><td className="px-3 py-2 font-semibold">{permission}</td>{roles.map((role) => <td key={role} className="px-3 py-2"><span className={`inline-flex h-5 w-9 items-center justify-center rounded-full text-[10px] font-semibold ${allowed(role, permission) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{allowed(role, permission) ? 'On' : 'Off'}</span></td>)}</tr>)}</tbody></table>
      </CrmCard>
    </PageFrame>
  );
}
