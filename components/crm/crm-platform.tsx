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
  const key = normalize(raw);
  const color =
    key.includes('funded') || key.includes('paid') || key.includes('eligible') ? '#059669' :
    key.includes('offer') || key.includes('signed') || key.includes('approved') ? '#2563EB' :
    key.includes('review') || key.includes('submitted') ? '#7C3AED' :
    key.includes('declined') || key.includes('lost') || key.includes('withdrawn') || key.includes('overdue') ? '#DC2626' :
    key.includes('docs') || key.includes('contract') || key.includes('pending') ? '#D97706' :
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
      supabase.from('leads').select('*').eq('organization_id', org).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('deals').select('*').eq('organization_id', org).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('offers').select('*').eq('organization_id', org).order('created_at', { ascending: false }),
      supabase.from('renewals').select('*').eq('organization_id', org).order('updated_at', { ascending: false }),
      supabase.from('commissions').select('*').eq('organization_id', org).order('created_at', { ascending: false }),
      supabase.from('funding_partners').select('*').eq('organization_id', org).order('name'),
      supabase.from('user_profiles').select('*').eq('organization_id', org).order('first_name'),
      supabase.from('activities').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      supabase.from('documents').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      supabase.from('notes').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      supabase.from('current_positions').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      supabase.from('deal_financials').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(100),
      supabase.from('businesses').select('*').eq('organization_id', org).is('deleted_at', null),
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
  }, [organizationId]);

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
    const result = editing
      ? await supabase.from('leads').update(payload).eq('id', editing.id)
      : await supabase.from('leads').insert(payload);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(editing ? 'Lead updated' : 'Lead added');
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
      stage_slug: 'lead_captured',
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
    <PageFrame title="Leads" subtitle="Lead intake, ownership, notes, and conversion workflow" actions={<Button className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={() => openLead()}><Plus className="mr-2 h-4 w-4" />Add lead</Button>}>
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
                <tr key={lead.id} className="hover:bg-[#F8FAFC]">
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
                      <Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => convertLead(lead)}>Convert</Button>
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
                <Input value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 rounded-[7px]" />
              </div>
            ))}
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
              <Textarea value={form.notes || ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 min-h-[96px] rounded-[7px]" />
            </div>
          </div>
          <DialogFooter><Button onClick={saveLead} className="rounded-[7px] bg-[#0F2B5B]">Save lead</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}

function DealTable({ rows }: { rows: RecordMap[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1420px] text-left text-sm">
        <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-normal text-[#64748B]">
          <tr>
            {['Deal ID', 'Business', 'Owner', 'Requested', 'Offered', 'Funded', 'Stage', 'Offer', 'Funded Status', 'Renewal', 'Current Balance', '% Paid', 'Assigned Rep', 'Funding Partner', 'Last Activity', 'Created'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {rows.map((deal) => {
            const offer = Array.isArray(deal.offers) ? deal.offers[0] : null;
            const renewal = Array.isArray(deal.renewals) ? deal.renewals[0] : null;
            const currentBalance = renewal?.current_balance || Math.max(Number(offer?.payback_amount || deal.funded_amount || 0) - Number(deal.funded_amount || 0) * 0.45, 0);
            const percentPaid = renewal?.percent_paid_down || (deal.stage_slug === 'funded' ? 55 : 0);
            return (
              <tr key={deal.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3"><Link href={`/crm/deals/${deal.id}`} className="font-semibold text-[#0F2B5B]">{shortId(deal.id)}</Link></td>
                <td className="px-4 py-3 font-semibold text-[#0F172A]">{businessName(deal)}</td>
                <td className="px-4 py-3 text-[#334155]">{deal.businesses?.contact_name || deal.businesses?.email || 'Merchant owner'}</td>
                <td className="px-4 py-3 font-semibold">{currency(deal.requested_amount)}</td>
                <td className="px-4 py-3">{currency(offer?.approved_amount || deal.approved_amount)}</td>
                <td className="px-4 py-3">{currency(deal.funded_amount)}</td>
                <td className="px-4 py-3"><StatusBadge value={deal.stage_slug} /></td>
                <td className="px-4 py-3"><StatusBadge value={offer?.status || 'pending'} /></td>
                <td className="px-4 py-3"><StatusBadge value={deal.funded_at ? 'funded' : 'not funded'} /></td>
                <td className="px-4 py-3"><StatusBadge value={renewal?.status || (deal.stage_slug === 'renewal_eligible' ? 'eligible' : 'not eligible')} /></td>
                <td className="px-4 py-3">{currency(currentBalance)}</td>
                <td className="px-4 py-3">{pct(percentPaid)}</td>
                <td className="px-4 py-3">{repName(deal)}</td>
                <td className="px-4 py-3">{offer?.funding_partners?.name || partnerName(deal)}</td>
                <td className="px-4 py-3 text-[#64748B]">{date(deal.updated_at)}</td>
                <td className="px-4 py-3 text-[#64748B]">{date(deal.created_at)}</td>
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
  const { deals, loading } = useCrmDataset();
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  if (loading) return <LoadingScreen title="Deals" />;
  const filtered = deals.filter((deal: RecordMap) => {
    const query = normalize(search);
    const statusMatch = stage === 'all' || deal.stage_slug === stage;
    const text = normalize([deal.id, businessName(deal), repName(deal), partnerName(deal), deal.stage_slug].join(' '));
    return statusMatch && (!query || text.includes(query));
  });
  return (
    <PageFrame title="Deals" subtitle="MCA deal board with offer, funded, renewal, and balance tracking" actions={<Button className="h-9 rounded-[7px] bg-[#0F2B5B]"><Plus className="mr-2 h-4 w-4" />New deal</Button>}>
      <CrmCard>
        <Toolbar search={search} setSearch={setSearch}>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="h-10 w-[190px] rounded-[7px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All stages</SelectItem>{STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" className="h-10 rounded-[7px]" onClick={() => exportCsv('deals', filtered)}><Download className="mr-2 h-4 w-4" />Export</Button>
        </Toolbar>
        <DealTable rows={filtered} />
      </CrmCard>
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
  const currentBalance = dealRenewals[0]?.current_balance || financial.current_balance || Math.max(Number(offer.payback_amount || deal.funded_amount || 0) - Number(deal.funded_amount || 0) * 0.45, 0);
  const percentPaid = dealRenewals[0]?.percent_paid_down || financial.percent_paid_down || (deal.stage_slug === 'funded' ? 55 : 0);

  return (
    <PageFrame title={businessName(deal)} subtitle={`Deal ${shortId(deal.id)} · ${stageLabel(deal.stage_slug)}`} actions={<Link href="/crm/deals" className="text-sm font-semibold text-[#0F2B5B]">Back to deals</Link>}>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <MetricCard title="Requested" value={currency(deal.requested_amount)} subtitle="Merchant ask" icon={<Target className="h-4 w-4" />} />
        <MetricCard title="Best Offer" value={currency(offer.approved_amount || deal.approved_amount)} subtitle={`${offer.factor_rate || 'N/A'} factor`} icon={<FileText className="h-4 w-4" />} tone="#2563EB" />
        <MetricCard title="Funded" value={currency(deal.funded_amount)} subtitle={date(deal.funded_at)} icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" />
        <MetricCard title="Current Balance" value={currency(currentBalance)} subtitle={`${pct(percentPaid)} paid down`} icon={<WalletCards className="h-4 w-4" />} tone="#D97706" />
      </div>

      <CrmCard className="p-4">
        <Tabs defaultValue="info">
          <TabsList className="mb-4 flex h-auto flex-wrap justify-start rounded-[8px] bg-[#F1F5F9] p-1">
            {['info', 'financials', 'merchant', 'positions', 'offers', 'documents', 'activity', 'notes', 'renewals'].map((tab) => <TabsTrigger key={tab} value={tab} className="rounded-[6px] capitalize">{tab === 'info' ? 'Deal Info' : tab}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="info"><InfoGrid rows={[['Stage', stageLabel(deal.stage_slug)], ['Assigned rep', repName(deal)], ['Funding partner', partnerName(offer)], ['Created', date(deal.created_at)], ['Last activity', date(deal.updated_at)], ['Probability', pct(deal.funding_probability)]]} /></TabsContent>
          <TabsContent value="financials"><InfoGrid rows={[['Requested amount', currency(deal.requested_amount)], ['Offered amount', currency(offer.approved_amount || deal.approved_amount)], ['Funded amount', currency(deal.funded_amount)], ['Total payback', currency(offer.payback_amount || financial.total_payback)], ['Current balance', currency(currentBalance)], ['Percent paid', pct(percentPaid)], ['Daily payment', currency(offer.daily_payment || financial.daily_payment)], ['Weekly payment', currency(offer.weekly_payment || financial.weekly_payment)]]} /></TabsContent>
          <TabsContent value="merchant"><InfoGrid rows={[['Legal name', deal.businesses?.legal_name || businessName(deal)], ['DBA', deal.businesses?.dba || 'None'], ['Industry', deal.businesses?.industry || 'Unknown'], ['Phone', deal.businesses?.phone || 'Unknown'], ['Email', deal.businesses?.email || 'Unknown'], ['Monthly revenue', currency(deal.businesses?.monthly_gross_revenue)], ['Location', [deal.businesses?.city, deal.businesses?.state].filter(Boolean).join(', ') || 'Unknown']]} /></TabsContent>
          <TabsContent value="positions"><SimpleRows rows={positions} empty="No current positions tracked." render={(row) => <div className="grid gap-2 md:grid-cols-5"><b>{row.funder_name}</b><span>{currency(row.original_funded_amount)}</span><span>{currency(row.current_balance)}</span><span>{currency(row.daily_payment || row.weekly_payment)}</span><StatusBadge value={row.status || 'active'} /></div>} /></TabsContent>
          <TabsContent value="offers"><SimpleRows rows={dealOffers} empty="No offers received yet." render={(row) => <div className="grid gap-2 md:grid-cols-6"><b>{partnerName(row)}</b><span>{currency(row.approved_amount)}</span><span>{row.factor_rate || 'N/A'} factor</span><span>{currency(row.payback_amount)}</span><span>{row.term_days || 'N/A'} days</span><StatusBadge value={row.status} /></div>} /></TabsContent>
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
              ['Remaining term', `${financial.remaining_term_days || offer.term_days || 0} days`],
              ['Estimated payoff date', date(financial.estimated_payoff_date || dealRenewals[0]?.renewal_date)],
              ['Renewal eligibility date', date(dealRenewals[0]?.renewal_date)],
              ['Renewal probability', pct(dealRenewals[0]?.renewal_probability || (percentPaid >= 50 ? 78 : 35))],
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
    ['Earnings', currency(commissions.reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0)), 'CSV / Excel / PDF'],
  ];
  return (
    <PageFrame title="Reports" subtitle="Date-filtered MCA production, rep, partner, renewal, and earnings reports" actions={<div className="flex gap-2"><Button variant="outline" className="h-9 rounded-[7px]"><Filter className="mr-2 h-4 w-4" />Date range</Button><Button className="h-9 rounded-[7px] bg-[#0F2B5B]"><Download className="mr-2 h-4 w-4" />Export pack</Button></div>}>
      <div className="grid gap-4 xl:grid-cols-2">
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Pipeline Conversion</h2><ResponsiveContainer width="100%" height={290}><BarChart data={conversion}><CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#0F2B5B" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></CrmCard>
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Funded Volume Trend</h2><ResponsiveContainer width="100%" height={290}><LineChart data={monthly}><CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => currency(value)} /><Line type="monotone" dataKey="funded" stroke="#C9A84C" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></CrmCard>
      </div>
      <CrmCard className="mt-4 overflow-hidden">
        <table className="w-full text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">Report</th><th className="px-4 py-3">Current value</th><th className="px-4 py-3">Exports</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-[#E2E8F0]">{reportRows.map(([name, value, exports]) => <tr key={name}><td className="px-4 py-3 font-semibold">{name}</td><td className="px-4 py-3">{value}</td><td className="px-4 py-3">{exports}</td><td className="px-4 py-3"><Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => toast.success(`${name} export prepared`)}>Export</Button></td></tr>)}</tbody></table>
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
  return (
    <PageFrame title="Renewals" subtitle="Paydown, eligibility, probability, and renewal alerts">
      <CrmCard className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr>{['Merchant', 'Funded date', 'Funded amount', 'Total payback', 'Current balance', '% paid down', 'Remaining term', 'Eligibility date', 'Probability', 'Alerts'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{rows.map((row: RecordMap) => <tr key={row.id}><td className="px-4 py-3 font-semibold">{businessName(row.deals || row)}</td><td className="px-4 py-3">{date(row.deals?.funded_at)}</td><td className="px-4 py-3">{currency(row.original_funded_amount || row.deals?.funded_amount)}</td><td className="px-4 py-3">{currency(Number(row.original_funded_amount || row.deals?.funded_amount || 0) * 1.35)}</td><td className="px-4 py-3">{currency(row.current_balance)}</td><td className="px-4 py-3">{pct(row.percent_paid_down)}</td><td className="px-4 py-3">42 days</td><td className="px-4 py-3">{date(row.renewal_date)}</td><td className="px-4 py-3">{pct(row.renewal_probability || 72)}</td><td className="px-4 py-3"><StatusBadge value={row.status} /></td></tr>)}</tbody></table>
      </CrmCard>
    </PageFrame>
  );
}

export function CrmUsersExperience() {
  const { users, deals, commissions, loading } = useCrmDataset();
  if (loading) return <LoadingScreen title="Users" />;
  return (
    <PageFrame title="User Management" subtitle="Create users, assign roles, activate accounts, and view performance" actions={<Button className="h-9 rounded-[7px] bg-[#0F2B5B]"><Plus className="mr-2 h-4 w-4" />Create user</Button>}>
      <CrmCard className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr>{['User', 'Role', 'Status', 'Deals', 'Funded volume', 'Earnings', 'Last login', 'Actions'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{users.map((user: RecordMap) => { const userDeals = deals.filter((deal: RecordMap) => deal.assigned_user_id === user.id); const userEarnings = commissions.filter((row: RecordMap) => row.rep_id === user.id).reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0); return <tr key={user.id}><td className="px-4 py-3"><p className="font-semibold">{[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}</p><p className="text-xs text-[#64748B]">{user.email}</p></td><td className="px-4 py-3 capitalize">{user.role?.replaceAll('_', ' ')}</td><td className="px-4 py-3"><StatusBadge value={user.is_active ? 'active' : 'inactive'} /></td><td className="px-4 py-3">{userDeals.length}</td><td className="px-4 py-3">{currency(userDeals.reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0))}</td><td className="px-4 py-3">{currency(userEarnings)}</td><td className="px-4 py-3">{date(user.last_login_at)}</td><td className="px-4 py-3"><Button variant="outline" size="sm" className="h-8 rounded-[7px]">Edit</Button></td></tr>; })}</tbody></table>
      </CrmCard>
    </PageFrame>
  );
}
