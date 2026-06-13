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
import { DeleteConfirmButton } from '@/components/crm/delete-confirm-button';
import { PartnerApplicationReviewForm } from '@/components/crm/partner-application-review-form';
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
import { DealAiAnalysisPlaceholder } from '@/components/crm/deal-ai-analysis-placeholder';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { isInternalCrmRole, isIsoPartnerRole } from '@/lib/access-control';
import { APPLICATION_DISCLOSURE_SECTIONS } from '@/lib/application-disclosures';
import { isActiveFunderSubmissionStatus } from '@/lib/lender-submission-duplicates';
import {
  getComplianceBlocks,
  getCrmReportSourceOfTruth,
  getDealScore,
  getDealOperatingSignals,
  getDisclosureState,
  getIsoQuality,
  getManagerCockpit,
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
  isoBrokers: RecordMap[];
  users: RecordMap[];
  accessInvites: RecordMap[];
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
  partnerApplications: RecordMap[];
};

type DashboardSummary = {
  metrics: {
    totalLeads: number;
    activeDeals: number;
    fundedDeals: number;
    totalFunded: number;
    pendingOffers: number;
    approvalRate: number;
    renewalOpportunities: number;
    estimatedEarnings: number;
    paidEarnings: number;
    needsAttention: number;
  };
  stageData: RecordMap[];
  partnerData: RecordMap[];
  repData: RecordMap[];
  attention: RecordMap[];
  activities: RecordMap[];
  cockpit: {
    averageHealth: number;
    stalledDeals: RecordMap[];
    blockedDeals: RecordMap[];
    readyToSubmit: RecordMap[];
    offerPending: RecordMap[];
    repRows: RecordMap[];
  };
};

const STAGES = [
  ['documents_requested', 'Docs needed'],
  ['application_submitted', 'Submitted'],
  ['approved', 'Approved'],
  ['declined', 'Declined'],
  ['contract_requested', 'Contracts requested'],
  ['contract_signed', 'Contracts signed'],
  ['funded', 'Funded'],
  ['defaulted', 'Defaulted'],
  ['renewal_eligible', 'Renewal eligible'],
] as const;

const LEGACY_STAGE_LABELS: Record<string, string> = {
  lead_captured: 'Docs needed',
  application_started: 'Docs needed',
  documents_received: 'Submitted',
  underwriting_review: 'Submitted',
  verification: 'Submitted',
  merchant_interview: 'Submitted',
  submission: 'Submitted',
  submitted_to_partners: 'Submitted',
  working_deal: 'Submitted',
  offers_received: 'Approved',
  offer_presented: 'Approved',
  approved_not_accepted: 'Declined',
  contract_sent: 'Contracts requested',
  in_funding: 'Contracts signed',
  lost_unresponsive: 'Declined',
  withdrawn: 'Declined',
};

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
  stage_slug: 'documents_requested',
  assigned_user_id: '',
  junior_closer_id: '',
  senior_closer_id: '',
  lead_source: 'manual_entry',
  notes: '',
};


const DETAIL_DOCUMENT_TYPES = [
  { value: 'completed_application', label: 'Completed Application' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'bank_statements', label: 'Bank Statements' },
  { value: 'license_verification', label: 'License Verification' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'voided_check', label: 'Voided Check' },
  { value: 'bank_letter', label: 'Bank Letter' },
  { value: 'tax_return', label: 'Tax Return' },
  { value: 'processing_statement', label: 'Processing Statement' },
  { value: 'financial_statement', label: 'Financial Statement' },
  { value: 'ar_report', label: 'A/R Report' },
  { value: 'business_verification', label: 'Business Verification' },
  { value: 'advance_statements', label: 'Advance Statements' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'signed_contract', label: 'Signed Contract' },
  { value: 'final_bank_verification', label: 'Final Bank Verification' },
  { value: 'final_owner_id_verification', label: 'Final Owner ID Verification' },
  { value: 'payoff_letter', label: 'Payoff Letter' },
  { value: 'stipulation', label: 'Stipulation' },
  { value: 'signed_application', label: 'Signed Application' },
  { value: 'partner_application', label: 'Partner Application' },
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

const DEAL_DOCUMENT_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif'];
const DEAL_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const MAX_DEAL_DOCUMENT_BYTES = 10 * 1024 * 1024;

function invalidDealDocumentFile(files: File[]) {
  return files.find((file) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return file.size > MAX_DEAL_DOCUMENT_BYTES || (!DEAL_DOCUMENT_MIME_TYPES.includes(file.type) && !DEAL_DOCUMENT_FILE_EXTENSIONS.includes(extension || ''));
  });
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
  company_name: '',
  access_entity_type: 'internal',
  access_entity_id: '',
  permissions: [] as string[],
  is_active: true,
};

const USER_PERMISSION_OPTIONS = [
  ['send_to_lenders', 'Send deals to funders'],
  ['manage_documents', 'Manage deal documents'],
  ['manage_commissions', 'Manage finance and commissions'],
  ['manage_users', 'Add and edit users'],
  ['manage_funders', 'Manage funders'],
  ['manage_isos', 'Manage ISOs'],
  ['reveal_sensitive', 'Reveal sensitive application data'],
  ['mark_defaulted', 'Mark funded deals defaulted'],
  ['view_shared_deals', 'View shared deals'],
  ['submit_applications', 'Submit applications'],
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

function shortId(id?: string) {
  return id ? id.slice(0, 8).toUpperCase() : 'UNASSIGNED';
}

function repReferralUrl(slug?: string | null) {
  if (!slug) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/apply/rep/${slug}`;
}

function lenderRequiredDocTypes(partner?: RecordMap | null) {
  const savedRequirements = Array.isArray(partner?.required_documents) ? (partner?.required_documents || []) : [];
  const rawProductTypes = partner?.product_types;
  const productTypes = Array.isArray(rawProductTypes) ? rawProductTypes.join(' ').toLowerCase() : String(rawProductTypes || '').toLowerCase();
  const notes = String(partner?.notes || '').toLowerCase();
  const required = new Set(['completed_application', 'bank_statement', 'bank_statements', 'drivers_license', 'license_verification', ...savedRequirements.map((item: string) => item.trim()).filter(Boolean)]);
  if (productTypes.includes('mca') || productTypes.includes('merchant') || notes.includes('voided')) required.add('voided_check');
  if (productTypes.includes('equipment')) required.add('invoice');
  if (productTypes.includes('invoice') || notes.includes('a/r') || notes.includes('receivable') || notes.includes('aging')) required.add('ar_report');
  if (notes.includes('tax')) required.add('tax_return');
  if (notes.includes('processing') || notes.includes('processor')) required.add('processing_statement');
  return Array.from(required);
}

function bestDocumentForType(docs: RecordMap[], type: string) {
  return docs
    .filter((doc) => sameDocType(doc.document_type, type) || sameDocType(doc.application_variant, type) || (type === 'completed_application' && doc.document_type === 'completed_application'))
    .sort((a, b) => {
      const score = (doc: RecordMap) => (doc.application_variant === 'elite_converted_partner' ? 4 : doc.status === 'approved' ? 3 : doc.status === 'uploaded' ? 2 : 1);
      return score(b) - score(a) || new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
    })[0];
}

function isFunderPackageDocument(doc: RecordMap) {
  if (!doc?.id) return false;
  if (['rejected', 'needs_replacement', 'expired', 'deleted'].includes(String(doc.status || '').toLowerCase())) return false;
  if (doc.document_type === 'completed_application') return false;
  if (doc.document_type === 'partner_application' || doc.application_variant === 'original_partner') return false;
  return true;
}

function defaultFunderPackageDocumentIds(docs: RecordMap[], partner?: RecordMap | null) {
  const requiredIds = lenderRequiredDocTypes(partner)
    .filter((type) => type !== 'completed_application')
    .map((type) => bestDocumentForType(docs, type)?.id)
    .filter(Boolean) as string[];
  const eligibleIds = docs.filter(isFunderPackageDocument).map((doc) => doc.id);
  return Array.from(new Set([...requiredIds, ...eligibleIds]));
}

function packageDocLabel(doc: RecordMap) {
  if (doc.document_type === 'completed_application' || doc.application_variant === 'elite_converted_partner' || doc.application_variant === 'elite_generated') return 'Elite application';
  return detailDocTypeLabel(doc.document_type || doc.application_variant || 'other');
}

function buildDefaultFunderMessage(deal: RecordMap, docs: RecordMap[], readiness: ReturnType<typeof calculateReadiness>, partner?: RecordMap | null) {
  const business = deal.businesses || {};
  const missing = readiness.missing.slice(0, 4).map((item) => item.name);
  const docTypes = Array.from(new Set(['Elite application', ...docs.map(packageDocLabel)])).slice(0, 6);
  return [
    `Hi${partner?.name ? ` ${partner.name} team` : ''},`,
    '',
    `Please review the attached funding package for ${business.legal_name || business.dba || businessName(deal)}.`,
    '',
    `Requested amount: ${deal.requested_amount ? currency(deal.requested_amount) : 'See application'}`,
    `Monthly revenue: ${business.monthly_gross_revenue ? currency(business.monthly_gross_revenue) : 'See file'}`,
    docTypes.length ? `Included package: ${docTypes.join(', ')}.` : '',
    missing.length ? `Open items we are tracking: ${missing.join(', ')}.` : '',
    '',
    'Please confirm receipt and let us know if you need any additional stips.',
    '',
    'Thank you,',
  ].filter((line) => line !== '').join('\n');
}

function repReferralDisplayUrl(slug?: string | null) {
  return repReferralUrl(slug) || 'Not generated';
}

function isoApplicationUrl(token?: string | null) {
  if (!token) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/apply/iso/${token}`;
}

function userDisplayName(user: RecordMap) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unnamed user';
}

function accessEntityTypeForUserRole(role: string) {
  if (role === 'funder') return 'funding_partner';
  if (role === 'iso_broker' || role === 'broker' || role === 'referral_partner') return 'iso_broker';
  if (role === 'client') return 'client';
  return 'internal';
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
  if (!stage) return 'Docs needed';
  return STAGE_LABELS[stage] || LEGACY_STAGE_LABELS[stage] || stage.replaceAll('_', ' ');
}

function normalizeStage(stage?: string) {
  if (stage && STAGE_LABELS[stage]) return stage;
  const label = stage ? LEGACY_STAGE_LABELS[stage] : '';
  const match = STAGES.find(([, stageName]) => stageName === label);
  return match ? match[0] : 'documents_requested';
}

function normalize(text: string) {
  return text.toLowerCase().trim();
}

function StatusBadge({ value }: { value?: string | null }) {
  const raw = value || 'new';
  const label = stageLabel(raw);
  const key = normalize(raw);
  const color =
    key.includes('funded') || key.includes('paid') || key.includes('eligible') || key.includes('ready') ? '#059669' :
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

function CrmCard({ children, className = '', ...props }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`rounded-[8px] border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>{children}</section>;
}

function MetricCard({ title, value, subtitle, icon, tone = '#0F2B5B', href }: { title: string; value: string | number; subtitle: string; icon: React.ReactNode; tone?: string; href?: string }) {
  const content = (
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
  if (!href) return content;
  return (
    <Link href={href} className="block rounded-[8px] outline-none transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)] focus-visible:ring-2 focus-visible:ring-[#0F2B5B] focus-visible:ring-offset-2">
      {content}
    </Link>
  );
}

function Toolbar({ search, setSearch, children }: { search: string; setSearch: (value: string) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-[420px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search merchants, reps, IDs, partners..." className="h-10 rounded-[7px] border-[#CBD5E1] pl-9 text-[13px]" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {search && <Button variant="outline" className="h-10 rounded-[7px]" onClick={() => setSearch('')}>Clear</Button>}
        {children}
      </div>
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
    commissionRecipients: [],
    riskEvents: [],
    partners: [],
    isoBrokers: [],
    users: [],
    accessInvites: [],
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
    partnerApplications: [],
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
      browserSupabase.from('funding_partners').select('*').eq('organization_id', org).is('deleted_at', null).order('name'),
      browserSupabase.from('user_profiles').select('*').eq('organization_id', org).is('deleted_at', null).order('first_name'),
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
      browserSupabase.from('partner_application_uploads').select('*').eq('organization_id', org).is('deleted_at', null).order('created_at', { ascending: false }).limit(200),
      browserSupabase.from('iso_brokers').select('*').eq('organization_id', org).is('deleted_at', null).order('company_name'),
      browserSupabase.from('crm_access_invites').select('*').eq('organization_id', org).order('created_at', { ascending: false }).limit(250),
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
      isoBrokers: unwrap(22),
      users,
      accessInvites: unwrap(23),
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
      partnerApplications: unwrap(21),
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
    <div className="flex h-full flex-col overflow-hidden" data-testid={`crm-page-${normalize(title).replaceAll(' ', '-')}`}>
      <CrmTopbar title={title} subtitle={subtitle} actions={actions} />
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 md:p-5">
        {children}
      </div>
    </div>
  );
}

export function CrmDashboardExperience() {
  const { profile, loading, error } = useCrmUser();

  if (loading) return <LoadingScreen title="Dashboard" />;
  if (profile && !isInternalCrmRole(profile.role)) return <PartnerDashboardContainer profile={profile} />;
  return <InternalDashboard profileError={error} />;
}

function useCrmDashboardSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/crm/dashboard/summary', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load dashboard summary.');
      setSummary(result as DashboardSummary);
    } catch (err: any) {
      setError(err.message || 'Unable to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { summary, loading, error, reload: load };
}

function PartnerDashboardContainer({ profile }: { profile: RecordMap }) {
  const { deals, offers, documents, partnerSubmissions, isoBrokers, loading, error } = useCrmDataset();
  if (loading) return <LoadingScreen title="Dashboard" />;
  return <PartnerDashboardExperience deals={deals} offers={offers} documents={documents} partnerSubmissions={partnerSubmissions} isoBrokers={isoBrokers} profile={profile} error={error} />;
}

function InternalDashboard({ profileError }: { profileError: string | null }) {
  const { summary, loading, error, reload } = useCrmDashboardSummary();

  if (loading) return <LoadingScreen title="Dashboard" />;
  const metrics = summary?.metrics || {
    totalLeads: 0,
    activeDeals: 0,
    fundedDeals: 0,
    totalFunded: 0,
    pendingOffers: 0,
    approvalRate: 0,
    renewalOpportunities: 0,
    estimatedEarnings: 0,
    paidEarnings: 0,
    needsAttention: 0,
  };
  const stageData = summary?.stageData || [];
  const partnerData = summary?.partnerData || [];
  const repData = summary?.repData || [];
  const attention = summary?.attention || [];
  const activities = summary?.activities || [];
  const cockpit = summary?.cockpit || { averageHealth: 100, stalledDeals: [], blockedDeals: [], readyToSubmit: [], offerPending: [], repRows: [] };

  return (
    <PageFrame title="Executive Dashboard" subtitle="MCA pipeline, production, renewals, and earnings at a glance" actions={<Button variant="outline" className="h-9 rounded-[7px]" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}>
      {(error || profileError) && <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error || profileError}</div>}
      <CrmCard className="mb-4 p-3">
        <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
          <div>
            <b className="text-[#0F172A]">Production mode:</b>
            <span className="ml-2 text-[#64748B]">Dashboard now loads from one server-side Supabase summary instead of 30+ browser queries.</span>
          </div>
          <StatusBadge value={error ? 'Needs review' : 'Fast summary active'} />
        </div>
      </CrmCard>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total Leads" value={metrics.totalLeads} subtitle="All active lead records" icon={<Users className="h-4 w-4" />} href="/crm/leads" />
        <MetricCard title="Active Deals" value={metrics.activeDeals} subtitle="Open funding pipeline" icon={<Briefcase className="h-4 w-4" />} tone="#2563EB" href="/crm/deals" />
        <MetricCard title="Deals Funded" value={metrics.fundedDeals} subtitle="Closed funded deals" icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" href="/crm/deals" />
        <MetricCard title="Total Funded Volume" value={currency(metrics.totalFunded)} subtitle="Lifetime funded volume" icon={<TrendingUp className="h-4 w-4" />} tone="#0F766E" href="/crm/reports" />
        <MetricCard title="Pending Offers" value={metrics.pendingOffers} subtitle="Received or presented" icon={<FileText className="h-4 w-4" />} tone="#D97706" href="/crm/offers" />
        <MetricCard title="Approval Rate" value={pct(metrics.approvalRate)} subtitle="Offer-or-better conversion" icon={<Percent className="h-4 w-4" />} tone="#7C3AED" href="/crm/reports" />
        <MetricCard title="Renewal Opportunities" value={metrics.renewalOpportunities} subtitle="Tracked renewal records" icon={<RefreshCw className="h-4 w-4" />} tone="#0891B2" href="/crm/renewals" />
        <MetricCard title="Estimated Earnings" value={currency(metrics.estimatedEarnings)} subtitle="Gross commission booked" icon={<WalletCards className="h-4 w-4" />} tone="#C9A84C" href="/crm/earnings" />
        <MetricCard title="Paid Earnings" value={currency(metrics.paidEarnings)} subtitle="Commission received" icon={<CheckCircle2 className="h-4 w-4" />} tone="#059669" href="/crm/earnings" />
        <MetricCard title="Needs Attention" value={metrics.needsAttention} subtitle="Docs, UW, or contracts" icon={<AlertTriangle className="h-4 w-4" />} tone="#DC2626" href="/crm/deals" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Avg Deal Health" value={`${cockpit.averageHealth}%`} subtitle="Open pipeline quality" icon={<Target className="h-4 w-4" />} tone={cockpit.averageHealth >= 75 ? '#059669' : cockpit.averageHealth >= 55 ? '#D97706' : '#DC2626'} href="/crm/deals" />
        <MetricCard title="Stalled Deals" value={cockpit.stalledDeals.length} subtitle="Past stage SLA" icon={<CalendarClock className="h-4 w-4" />} tone="#DC2626" href="/crm/deals" />
        <MetricCard title="Blocked Files" value={cockpit.blockedDeals.length} subtitle="Health below target" icon={<AlertTriangle className="h-4 w-4" />} tone="#B91C1C" href="/crm/deals" />
        <MetricCard title="Ready to Submit" value={cockpit.readyToSubmit.length} subtitle="Packageable files" icon={<Send className="h-4 w-4" />} tone="#2563EB" href="/crm/deals" />
        <MetricCard title="Offer Follow-up" value={cockpit.offerPending.length} subtitle="Merchant decision needed" icon={<Mail className="h-4 w-4" />} tone="#C9A84C" href="/crm/offers" />
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
          <p className="text-xs text-[#64748B]">Offer activity by funder</p>
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
        <CrmCard className="xl:col-span-3">
          <div className="border-b border-[#E2E8F0] p-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">Manager Cockpit</h2>
            <p className="text-xs text-[#64748B]">SLA misses, blockers, and files ready for action</p>
          </div>
          <div className="grid gap-0 divide-y divide-[#E2E8F0] xl:grid-cols-3 xl:divide-x xl:divide-y-0">
            <div className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[#64748B]">Stalled</p>
              <div className="mt-3 space-y-3">
                {cockpit.stalledDeals.slice(0, 4).map((row) => (
                  <Link key={row.deal.id} href={`/crm/deals/${row.deal.id}`} className="block rounded-[7px] border border-[#E2E8F0] p-3 hover:border-[#C9A84C]">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">{row.deal.display_name || businessName(row.deal)}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{stageLabel(row.deal.stage_slug)} · {row.stageAgeDays}d in stage · SLA {row.slaDays}d</p>
                  </Link>
                ))}
                {!cockpit.stalledDeals.length && <p className="text-sm text-[#64748B]">No open deal is past its stage SLA.</p>}
              </div>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[#64748B]">Blocked</p>
              <div className="mt-3 space-y-3">
                {cockpit.blockedDeals.slice(0, 4).map((row) => (
                  <Link key={row.deal.id} href={`/crm/deals/${row.deal.id}`} className="block rounded-[7px] border border-[#E2E8F0] p-3 hover:border-[#C9A84C]">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">{row.deal.display_name || businessName(row.deal)}</p>
                    <p className="mt-1 text-xs text-[#64748B]">{row.healthScore}% health · {row.nextAction}</p>
                  </Link>
                ))}
                {!cockpit.blockedDeals.length && <p className="text-sm text-[#64748B]">No blocked open files.</p>}
              </div>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[#64748B]">Rep Load</p>
              <div className="mt-3 space-y-3">
                {cockpit.repRows.slice(0, 5).map((row) => (
                  <div key={row.user.id} className="grid grid-cols-[1fr_64px_92px] gap-2 text-sm">
                    <span className="truncate font-medium text-[#0F172A]">{userDisplayName(row.user)}</span>
                    <span className="text-right text-[#64748B]">{row.ownedDealCount || row.ownedDeals?.length || 0} deals</span>
                    <span className="text-right font-semibold text-[#0F172A]">{currency(row.fundedVolume)}</span>
                  </div>
                ))}
                {!cockpit.repRows.length && <p className="text-sm text-[#64748B]">No rep records loaded.</p>}
              </div>
            </div>
          </div>
        </CrmCard>

        <CrmCard className="xl:col-span-2">
          <div className="border-b border-[#E2E8F0] p-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">Deals Requiring Attention</h2>
            <p className="text-xs text-[#64748B]">Files most likely to stall without follow-up</p>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {attention.length ? attention.map((deal: RecordMap) => (
              <Link key={deal.id} href={`/crm/deals/${deal.id}`} className="grid gap-3 p-4 text-sm hover:bg-[#F8FAFC] md:grid-cols-[1fr_140px_130px_110px] md:items-center">
                <div><p className="font-semibold text-[#0F172A]">{deal.display_name || businessName(deal)}</p><p className="text-xs text-[#64748B]">Deal {shortId(deal.id)} · {repName(deal)}</p></div>
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
            {activities.slice(0, 6).map((item: RecordMap) => (
              <div key={item.id} className="p-4 text-sm">
                <p className="font-medium text-[#0F172A]">{item.title || item.action || 'Activity'}</p>
                <p className="mt-1 text-xs text-[#64748B]">{date(item.created_at || item.updated_at)}</p>
              </div>
            ))}
            {!activities.length && <EmptyState title="No recent activity" body="New CRM movement will appear here." />}
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

function PartnerDashboardExperience({ deals, offers, documents, partnerSubmissions, isoBrokers, profile, error }: { deals: RecordMap[]; offers: RecordMap[]; documents: RecordMap[]; partnerSubmissions: RecordMap[]; isoBrokers: RecordMap[]; profile: RecordMap; error: string | null }) {
  const broker = isIsoPartnerRole(profile.role) ? isoBrokers.find((row: RecordMap) => row.id === profile.access_entity_id) : null;
  const applicationUrl = isoApplicationUrl(broker?.application_token || broker?.application_slug);
  const activeDeals = deals.filter((deal: RecordMap) => !['funded', 'declined', 'defaulted', 'lost_unresponsive'].includes(deal.stage_slug));
  const docsNeeded = deals.filter((deal: RecordMap) => ['documents_requested', 'application_submitted'].includes(deal.stage_slug)).length;
  const latestDeals = deals.slice(0, 8);

  return (
    <PageFrame
      title={profile.role === 'funder' ? 'Funder Workspace' : 'Partner Workspace'}
      subtitle={profile.company_name || broker?.company_name || 'Scoped CRM access for your submitted files'}
      actions={applicationUrl ? <Link href={applicationUrl} target="_blank" className="inline-flex h-9 items-center rounded-[7px] bg-[#0F2B5B] px-3 text-sm font-semibold text-white">Submit Application</Link> : null}
    >
      {error && <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard title="Visible Deals" value={deals.length} subtitle="Files assigned to your organization" icon={<Briefcase className="h-4 w-4" />} href="/crm/deals" />
        <MetricCard title="Active Files" value={activeDeals.length} subtitle="Open submissions in review" icon={<ClipboardList className="h-4 w-4" />} tone="#2563EB" href="/crm/deals" />
        <MetricCard title="Documents" value={documents.length} subtitle="Attached files available to you" icon={<FileText className="h-4 w-4" />} tone="#0F766E" />
        <MetricCard title="Needs Docs" value={docsNeeded} subtitle="Files waiting on merchant docs" icon={<AlertTriangle className="h-4 w-4" />} tone="#D97706" href="/crm/deals" />
      </div>
      {applicationUrl && (
        <CrmCard className="mt-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">Your application link</h2>
              <p className="mt-1 break-all text-sm font-medium text-[#334155]">{applicationUrl}</p>
            </div>
            <Button variant="outline" className="h-9 rounded-[7px]" onClick={() => navigator.clipboard?.writeText(applicationUrl)}>Copy Link</Button>
          </div>
        </CrmCard>
      )}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <CrmCard>
          <div className="border-b border-[#E2E8F0] p-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">Recent submissions</h2>
            <p className="text-xs text-[#64748B]">Only records available to your organization are shown.</p>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {latestDeals.length ? latestDeals.map((deal: RecordMap) => (
              <Link key={deal.id} href={`/crm/deals/${deal.id}`} className="grid gap-2 p-4 text-sm hover:bg-[#F8FAFC] md:grid-cols-[1fr_140px_130px] md:items-center">
                <div><p className="font-semibold text-[#0F172A]">{businessName(deal)}</p><p className="text-xs text-[#64748B]">Deal {shortId(deal.id)}</p></div>
                <div>{currency(deal.requested_amount)}</div>
                <StatusBadge value={deal.stage_slug} />
              </Link>
            )) : <EmptyState title="No submissions yet" body={applicationUrl ? 'Use your application link to submit the first file.' : 'No files have been assigned to your organization yet.'} />}
          </div>
        </CrmCard>
        <CrmCard>
          <div className="border-b border-[#E2E8F0] p-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">Funder activity</h2>
            <p className="text-xs text-[#64748B]">Submission and offer status visible to your role.</p>
          </div>
          <SimpleRows rows={partnerSubmissions.slice(0, 5)} empty="No funder submissions visible yet." render={(row) => <div><b>{partnerName(row)}</b><p className="text-sm text-[#334155]">{row.notes || row.decline_reason || 'No notes shared'}</p><p className="text-xs text-[#64748B]">{date(row.updated_at || row.created_at)} · {row.status || 'submitted'}</p></div>} />
          {offers.length > 0 && <div className="border-t border-[#E2E8F0] p-4 text-sm"><b>{offers.length} offer(s) visible</b><p className="mt-1 text-[#64748B]">Open the Deals page to review terms attached to each file.</p></div>}
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
    <PageFrame title="Leads" subtitle="Lead intake, ownership, notes, import, and conversion workflow" actions={<div className="flex gap-2"><Button data-testid="import-leads" variant="outline" className="h-9 rounded-[7px]" onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Import CSV</Button><Button data-testid="add-lead" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={() => openLead()}><Plus className="mr-2 h-4 w-4" />Add lead</Button></div>}>
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
                      <DeleteConfirmButton
                        itemLabel={`lead ${lead.business_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.id}`}
                        endpoint={`/api/crm/leads/${lead.id}`}
                        onDeleted={reload}
                        buttonClassName="h-8 rounded-[7px]"
                      />
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

function DealTable({ rows, canEditStage, onStageChange }: { rows: RecordMap[]; canEditStage: boolean; onStageChange: (deal: RecordMap, stage_slug: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-normal text-[#64748B]">
          <tr>
            {['Deal ID', 'Company name', 'Requested', 'Stage', 'Offer', 'Assigned Rep'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {rows.map((deal) => {
            const offer = Array.isArray(deal.offers) ? deal.offers[0] : null;
            const offerAmount = Number(offer?.approved_amount || deal.approved_amount || 0);
            return (
              <tr key={deal.id} className="hover:bg-[#F8FAFC]" data-testid={`deal-row-${deal.id}`}>
                <td className="px-4 py-3"><Link href={`/crm/deals/${deal.id}`} className="font-semibold text-[#0F2B5B]">{shortId(deal.id)}</Link></td>
                <td className="px-4 py-3"><Link href={`/crm/deals/${deal.id}`} className="font-semibold text-[#0F172A] hover:text-[#0F2B5B]">{businessName(deal)}</Link></td>
                <td className="px-4 py-3 font-semibold">{currency(deal.requested_amount)}</td>
                <td className="px-4 py-3">
                  {canEditStage ? (
                    <Select value={normalizeStage(deal.stage_slug)} onValueChange={(value) => onStageChange(deal, value)}>
                      <SelectTrigger data-testid={`deal-stage-${deal.id}`} className="h-9 w-[190px] rounded-[7px] text-[13px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <StatusBadge value={stageLabel(deal.stage_slug)} />}
                </td>
                <td className="px-4 py-3">{offerAmount > 0 ? <span><b>{currency(offerAmount)}</b>{offer?.status ? <span className="ml-2 align-middle"><StatusBadge value={offer.status} /></span> : null}</span> : <span className="text-[#94A3B8]">No offer yet</span>}</td>
                <td className="px-4 py-3">{repName(deal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <EmptyState title="No deals found" body="Adjust the search or stage filter, or create a new deal to get started." />}
    </div>
  );
}

export function CrmDealsExperience() {
  const { deals, users, isoBrokers, profile, loading, reload } = useCrmDataset();
  const { profile: directProfile, loading: directProfileLoading } = useCrmUser();
  const activeProfile = directProfile || profile;
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RecordMap>(emptyDeal);
  const [dealDocumentFiles, setDealDocumentFiles] = useState<File[]>([]);
  const [dealDocumentUploadProgress, setDealDocumentUploadProgress] = useState('');
  const [savingDeal, setSavingDeal] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedStage = params.get('stage');
    if (requestedStage && STAGE_LABELS[requestedStage]) setStage(requestedStage);
  }, []);
  if (loading || directProfileLoading) return <LoadingScreen title="Deals" />;
  const canCreateDeals = !!activeProfile && isInternalCrmRole(activeProfile.role);
  const canEditStage = !!activeProfile && isInternalCrmRole(activeProfile.role);
  const broker = activeProfile && isIsoPartnerRole(activeProfile.role) ? isoBrokers.find((row: RecordMap) => row.id === activeProfile.access_entity_id) : null;
  const applicationUrl = isoApplicationUrl(broker?.application_token || broker?.application_slug);
  const filtered = deals.filter((deal: RecordMap) => {
    const query = normalize(search);
    const statusMatch = stage === 'all' || normalizeStage(deal.stage_slug) === stage;
    const text = normalize([deal.id, businessName(deal), repName(deal), partnerName(deal), deal.stage_slug].join(' '));
    return statusMatch && (!query || text.includes(query));
  });

  const changeDealStage = async (deal: RecordMap, stage_slug: string) => {
    if (normalizeStage(deal.stage_slug) === stage_slug) return;
    const response = await fetch(`/api/crm/deals/${deal.id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_slug, notes: `Deals table stage update: ${stageLabel(deal.stage_slug)} -> ${stageLabel(stage_slug)}` }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to update deal stage');
    else { toast.success(`Stage updated to ${stageLabel(stage_slug)}`); reload(); }
  };

  const resetDealDialog = () => {
    setForm(emptyDeal);
    setDealDocumentFiles([]);
    setDealDocumentUploadProgress('');
  };

  const uploadNewDealDocuments = async (dealId: string) => {
    for (let index = 0; index < dealDocumentFiles.length; index += 1) {
      const file = dealDocumentFiles[index];
      setDealDocumentUploadProgress(`Uploading ${index + 1} of ${dealDocumentFiles.length}: ${file.name}`);
      const formData = new FormData();
      formData.set('file', file);
      formData.set('review_notes', 'Uploaded during CRM deal creation.');
      const response = await fetch(`/api/crm/deals/${dealId}/documents`, { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || `Failed to upload ${file.name}`);
    }
  };

  const saveDeal = async () => {
    const invalidFile = invalidDealDocumentFile(dealDocumentFiles);
    if (invalidFile) {
      toast.error(`${invalidFile.name} must be a PDF, JPG, PNG, or HEIC file up to 10MB.`);
      return;
    }
    setSavingDeal(true);
    setDealDocumentUploadProgress('');
    const payload = {
      title: form.title || 'New deal',
      business_name: form.title || 'New deal',
      requested_amount: form.requested_amount ? Number(form.requested_amount) : null,
      approved_amount: form.approved_amount ? Number(form.approved_amount) : null,
      funded_amount: form.funded_amount ? Number(form.funded_amount) : null,
      stage_slug: form.stage_slug || 'documents_requested',
      assigned_user_id: form.assigned_user_id || null,
      junior_closer_id: form.junior_closer_id || null,
      senior_closer_id: form.senior_closer_id || null,
      lead_source: form.lead_source || 'manual_entry',
      notes: form.notes || null,
    };
    try {
      const response = await fetch('/api/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to add deal');

      const dealId = result.dealId || result.deal?.id;
      if (dealDocumentFiles.length) {
        if (!dealId) throw new Error('Deal was created, but the response did not include a deal ID for document upload.');
        await uploadNewDealDocuments(dealId);
      }

      if (result.duplicateWarning) toast.warning(result.duplicateWarning);
      else toast.success(dealDocumentFiles.length ? `Deal added with ${dealDocumentFiles.length} document${dealDocumentFiles.length === 1 ? '' : 's'}` : 'Deal added');
      setDialogOpen(false);
      resetDealDialog();
      reload();
    } catch (error: any) {
      toast.error(error.message || 'Unable to add deal');
    } finally {
      setSavingDeal(false);
    }
  };

  return (
    <PageFrame title={canCreateDeals ? 'Deals' : 'My Submissions'} subtitle={canCreateDeals ? 'All deals with inline stage updates, offers, and rep assignment' : 'Submitted files visible to your organization'} actions={canCreateDeals ? <Button data-testid="new-deal" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={() => { resetDealDialog(); setDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />New deal</Button> : applicationUrl ? <Link href={applicationUrl} target="_blank" className="inline-flex h-9 items-center rounded-[7px] bg-[#0F2B5B] px-3 text-sm font-semibold text-white"><Plus className="mr-2 h-4 w-4" />Submit Application</Link> : null}>
      <CrmCard>
        <Toolbar search={search} setSearch={setSearch}>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="h-10 w-[190px] rounded-[7px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All stages</SelectItem>{STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          {canCreateDeals && <Button variant="outline" className="h-10 rounded-[7px]" onClick={() => exportCsv('deals', filtered)}><Download className="mr-2 h-4 w-4" />Export</Button>}
        </Toolbar>
        <DealTable rows={filtered} canEditStage={canEditStage} onStageChange={changeDealStage} />
      </CrmCard>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetDealDialog(); }}>
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
            <div className="md:col-span-2">
              <Label className="text-xs text-[#64748B]">Documents</Label>
              <Input data-testid="deal-create-document-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" onChange={(event) => setDealDocumentFiles(Array.from(event.target.files || []))} className="mt-1 rounded-[7px]" />
              {dealDocumentFiles.length > 0 && <div className="mt-2 grid gap-1 text-xs text-[#64748B]">{dealDocumentFiles.map((file) => <p key={`${file.name}-${file.size}`}>{file.name} · {formatBytes(file.size)}</p>)}</div>}
              {dealDocumentUploadProgress && <p className="mt-2 text-xs font-semibold text-[#0F2B5B]">{dealDocumentUploadProgress}</p>}
            </div>
          </div>
          <DialogFooter><Button data-testid="save-deal" onClick={saveDeal} disabled={savingDeal} className="rounded-[7px] bg-[#0F2B5B]">{savingDeal ? (dealDocumentFiles.length ? 'Saving and uploading...' : 'Saving...') : 'Save deal'}</Button></DialogFooter>
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
  { key: 'approved_offer', name: 'Approved funder offer', category: 'funding' as ChecklistCategory },
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
  const arAliases = ['arreport', 'araging', 'aragingreport', 'accountsreceivable', 'accountsreceivablereport', 'receivableaging', 'receivablesaging', 'agingreport'];
  return a === b
    || (wanted === 'license_verification' && ['drivers_license', 'driver_license', 'owner_id_verification'].includes(docType))
    || (wanted === 'owner_id_verification' && ['drivers_license', 'driver_license', 'license_verification'].includes(docType))
    || (wanted === 'completed_application' && ['signed_application', 'application'].includes(docType))
    || (arAliases.includes(a) && arAliases.includes(b));
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

function uniqueRecordsById(rows: RecordMap[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function CrmDealDetailExperience({ dealId }: { dealId: string }) {
  const { deals, offers, partners, documents, activities, notes, partnerSubmissions, renewals, commissions, commissionRecipients, riskEvents, currentPositions, dealFinancials, documentRequests, tasks, stipulations, applications, owners, users, partnerApplications, profile, loading, reload } = useCrmDataset();
  const { profile: directProfile, loading: directProfileLoading } = useCrmUser();
  const activeProfile = directProfile || profile;
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [partnerApplicationDialogOpen, setPartnerApplicationDialogOpen] = useState(false);
  const [partnerApplicationReviewOpen, setPartnerApplicationReviewOpen] = useState(false);
  const [applicationLinkDialogOpen, setApplicationLinkDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [submissionDialogOpen, setSubmissionDialogOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadingPartnerApplication, setUploadingPartnerApplication] = useState(false);
  const [generatingApplicationPdf, setGeneratingApplicationPdf] = useState(false);
  const [sendingApplicationLink, setSendingApplicationLink] = useState(false);
  const [requestingMissingDocs, setRequestingMissingDocs] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingSubmission, setSavingSubmission] = useState(false);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentUploadProgress, setDocumentUploadProgress] = useState('');
  const [partnerApplicationFile, setPartnerApplicationFile] = useState<File | null>(null);
  const [partnerApplicationSource, setPartnerApplicationSource] = useState('');
  const [partnerApplicationNotes, setPartnerApplicationNotes] = useState('');
  const [reviewingPartnerApplication, setReviewingPartnerApplication] = useState<RecordMap | null>(null);
  const [dealDetailTab, setDealDetailTab] = useState('overview');
  const [applicationLinkEmail, setApplicationLinkEmail] = useState('');
  const [applicationLinkMessage, setApplicationLinkMessage] = useState('');
  const [generatedApplicationLink, setGeneratedApplicationLink] = useState('');
  const [revealedSensitiveData, setRevealedSensitiveData] = useState<RecordMap | null>(null);
  const [revealingSensitiveData, setRevealingSensitiveData] = useState(false);
  const [documentDescription, setDocumentDescription] = useState('');
  const [documentLabel, setDocumentLabel] = useState('');
  const [documentType, setDocumentType] = useState('auto');
  const [documentFilter, setDocumentFilter] = useState('all');
  const [noteBody, setNoteBody] = useState('');
  const [noteInternal, setNoteInternal] = useState(true);
  const [submissionPartnerIds, setSubmissionPartnerIds] = useState<string[]>([]);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionDocumentIds, setSubmissionDocumentIds] = useState<string[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({});
  const [commissionForm, setCommissionForm] = useState<RecordMap>({ recipient_name: '', recipient_type: 'referral_partner', percentage: '20', flat_amount: '', notes: '', payout_status: 'pending' });
  const [riskForm, setRiskForm] = useState<RecordMap>({ event_type: 'defaulted', funding_partner_id: '', amount: '', notes: '' });
  const [recentPartnerApplicationBundles, setRecentPartnerApplicationBundles] = useState<RecordMap[]>([]);
  useEffect(() => {
    setRecentPartnerApplicationBundles([]);
    setDealDetailTab('overview');
  }, [dealId]);
  // Auto-load full (unmasked) EIN/SSN/DOB for the deal. Server restricts this to internal
  // CRM team members; external roles simply fall back to whatever is already on the record.
  useEffect(() => {
    setRevealedSensitiveData(null);
    if (!dealId) return;
    let cancelled = false;
    fetch(`/api/crm/deals/${dealId}/sensitive`, { method: 'POST' })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => { if (!cancelled && result?.success) setRevealedSensitiveData(result.data || null); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [dealId]);
  useEffect(() => {
    if (!profile || ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'viewer'].includes(profile.role)) return;
    fetch('/api/crm/access-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'external_deal_viewed', resource_type: 'deals', resource_id: dealId }),
    }).catch(() => null);
  }, [dealId, profile]);
  if (loading || directProfileLoading) return <LoadingScreen title="Deal Detail" />;
  const deal = deals.find((row: RecordMap) => row.id === dealId) || deals[0];
  if (!deal) return <PageFrame title="Deal Detail" subtitle="No deal selected"><EmptyState title="Deal not found" body="The requested deal could not be loaded." /></PageFrame>;
  const app = applications.find((row: RecordMap) => row.id === deal.application_id || row.business_id === deal.business_id);
  const dealOffers = offers.filter((offer: RecordMap) => offer.deal_id === deal.id);
  const dealCommissions = commissions.filter((row: RecordMap) => row.deal_id === deal.id);
  const dealCommissionRecipients = commissionRecipients.filter((row: RecordMap) => row.deal_id === deal.id);
  const dealRiskEvents = riskEvents.filter((row: RecordMap) => row.deal_id === deal.id || row.business_id === deal.business_id);
  const repeatDeals = deals.filter((row: RecordMap) => row.id !== deal.id && (row.business_id === deal.business_id || row.duplicate_of_business_id === deal.business_id || row.business_id === deal.duplicate_of_business_id));
  const recentPartnerBundlesForDeal = recentPartnerApplicationBundles.filter((bundle) => bundle.deal_id === deal.id || bundle.partnerApplication?.deal_id === deal.id || (deal.application_id && bundle.application_id === deal.application_id));
  const recentPartnerDocs = recentPartnerBundlesForDeal.flatMap((bundle) => bundle.documents || []);
  const recentPartnerApplications = recentPartnerBundlesForDeal.map((bundle) => bundle.partnerApplication).filter(Boolean);
  const dealDocs = uniqueRecordsById([...recentPartnerDocs, ...documents]).filter((doc: RecordMap) => doc.deal_id === deal.id || (deal.application_id && doc.application_id === deal.application_id) || recentPartnerBundlesForDeal.some((bundle) => doc.application_id && doc.application_id === bundle.application_id));
  const dealPartnerApplications = uniqueRecordsById([...recentPartnerApplications, ...partnerApplications]).filter((row: RecordMap) => row.deal_id === deal.id || (deal.application_id && row.application_id === deal.application_id) || recentPartnerBundlesForDeal.some((bundle) => row.application_id && row.application_id === bundle.application_id));
  const originalPartnerApplicationDocs = dealDocs.filter((doc: RecordMap) => doc.application_variant === 'original_partner' || doc.document_type === 'partner_application');
  const convertedApplicationDocs = dealDocs.filter((doc: RecordMap) => doc.application_variant === 'elite_converted_partner' || doc.application_variant === 'elite_generated' || doc.document_type === 'completed_application');
  const publicApplicationStatus = app?.application_source ? app.application_source : app?.submitted_at ? 'website' : 'not_started';
  const dealRequests = documentRequests.filter((request: RecordMap) => request.deal_id === deal.id || (deal.application_id && request.application_id === deal.application_id));
  const dealStips = stipulations.filter((stip: RecordMap) => stip.deal_id === deal.id || dealOffers.some((offer: RecordMap) => offer.id === stip.offer_id));
  const dealTasks = tasks.filter((task: RecordMap) => task.deal_id === deal.id || (deal.application_id && task.application_id === deal.application_id)).sort((a: RecordMap, b: RecordMap) => new Date(a.due_date || '2999-01-01').getTime() - new Date(b.due_date || '2999-01-01').getTime());
  const businessOwners = owners.filter((owner: RecordMap) => owner.business_id === deal.business_id || owner.id === deal.owner_id);
  // Fallback: when no CRM owner records exist yet (e.g. only a partner application has been
  // uploaded), surface owner details captured in the application payload so the Owner info
  // card is not blank when an application is clearly on file.
  const ownersFromPayload = (payload: RecordMap | null | undefined): RecordMap[] => {
    if (!payload) return [];
    return ['owner1', 'owner2']
      .map((key) => payload[key])
      .filter((o: RecordMap) => o && (o.first_name || o.last_name || o.full_name || o.email || o.phone || o.ssn || o.dob))
      .map((o: RecordMap, index: number) => ({
        id: `payload-owner-${index}`,
        first_name: o.first_name,
        last_name: o.last_name,
        full_name: o.full_name,
        phone: o.phone || o.mobile,
        email: o.email,
        address: o.address || o.home_address,
        city: o.city,
        state: o.state,
        zip: o.zip,
        ownership_percentage: o.ownership_percentage,
        ssn: o.ssn || undefined,
        ssn_last4: o.ssn ? String(o.ssn).replace(/\D/g, '').slice(-4) : undefined,
        dob: o.dob,
      }));
  };
  const ownerPayloadSource = (app?.application_payload && (app.application_payload.owner1 || app.application_payload.owner2))
    ? app.application_payload
    : (dealPartnerApplications[0]?.edited_payload || dealPartnerApplications[0]?.extracted_payload || app?.application_payload || null);
  const displayOwners = businessOwners.length ? businessOwners : ownersFromPayload(ownerPayloadSource);
  const sensitiveOwnersById: Record<string, RecordMap> = Object.fromEntries((revealedSensitiveData?.owners || []).map((o: RecordMap) => [o.id, o]));
  const dealRenewals = renewals.filter((renewal: RecordMap) => renewal.original_deal_id === deal.id);
  const financial = dealFinancials.find((row: RecordMap) => row.deal_id === deal.id) || {};
  const positions = currentPositions.filter((row: RecordMap) => row.deal_id === deal.id || row.business_id === deal.business_id);
  const offer = dealOffers[0] || {};
  const intelligence = getDealScore(deal, dealDocs, positions);
  const complianceBlocks = getComplianceBlocks(deal, dealDocs);
  const disclosureState = getDisclosureState(deal.businesses);
  const partnerMatches = getPartnerMatches(deal, partners, dealDocs, positions).slice(0, 5);
  const currentBalance = dealRenewals[0]?.current_balance || financial.current_balance || Math.max(Number(offer.payback_amount || deal.funded_amount || 0) - Number(deal.funded_amount || 0) * 0.45, 0);
  const percentPaid = dealRenewals[0]?.percent_paid_down || financial.percent_paid_down || (deal.stage_slug === 'funded' ? 55 : 0);
  const internalUser = !!activeProfile && isInternalCrmRole(activeProfile.role);
  const isoPartnerUser = !!activeProfile && isIsoPartnerRole(activeProfile.role);
  const canUploadDocuments = internalUser || isoPartnerUser;
  const canUpdateDocuments = internalUser;
  const canManageApplications = internalUser;
  const canAddNotes = internalUser;
  const canUpdateLenderSubmissions = internalUser || activeProfile?.role === 'funder';
  const canEditFinancials = internalUser;
  const dealNotes = notes.filter((row: RecordMap) => (row.deal_id === deal.id || (deal.application_id && row.application_id === deal.application_id)) && (internalUser || !row.is_internal));
  const dealSubmissions = partnerSubmissions.filter((row: RecordMap) => row.deal_id === deal.id);
  const historyDeals = [deal, ...repeatDeals].sort((a: RecordMap, b: RecordMap) => Number(a.submission_sequence || 0) - Number(b.submission_sequence || 0) || new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const selectedSubmissionPartners = partners.filter((row: RecordMap) => submissionPartnerIds.includes(row.id));
  const selectedPartnerDefaultEvents = riskEvents.filter((row: RecordMap) => row.business_id === deal.business_id && submissionPartnerIds.includes(row.funding_partner_id) && row.event_type === 'defaulted');
  const duplicateSubmissionPartners = selectedSubmissionPartners.filter((partner: RecordMap) => dealSubmissions.some((row: RecordMap) => row.funding_partner_id === partner.id && !['withdrawn', 'declined'].includes(String(row.status || '').toLowerCase())));
  const selectedPartnerRequiredDocTypes = Array.from(new Set(selectedSubmissionPartners.flatMap((partner: RecordMap) => lenderRequiredDocTypes(partner))));
  const selectedPartnerMissingDocTypes = selectedSubmissionPartners.length ? selectedPartnerRequiredDocTypes.filter((type) => !bestDocumentForType(dealDocs, type)) : [];
  const canSendToLenders = ['super_admin', 'admin', 'sales_rep'].includes(activeProfile?.role || '');
  const checklist = buildDealChecklist(deal, dealDocs, dealRequests, dealOffers, positions, dealStips, app, businessOwners);
  const submissionReadiness = calculateReadiness(checklist, 'submission');
  const fundingReadiness = calculateReadiness(checklist, 'funding');
  const offerInsights = getOfferInsights(dealOffers);
  const canWaive = ['super_admin', 'admin', 'manager', 'underwriter'].includes(profile?.role || '');
  const canMarkFunded = ['super_admin', 'admin', 'manager'].includes(profile?.role || '');
  const filteredDocs = documentFilter === 'all' ? dealDocs : dealDocs.filter((doc: RecordMap) => doc.status === documentFilter || doc.document_type === documentFilter);
  const missingDocItems = checklist.filter((item) => ['missing', 'requested', 'rejected', 'needs_replacement'].includes(item.status) && ['submission', 'compliance', 'funding'].includes(item.category));
  const groupedDocs = DETAIL_DOCUMENT_TYPES.map((type) => ({ type, docs: filteredDocs.filter((doc: RecordMap) => sameDocType(doc.document_type, type.value)) })).filter((group) => group.docs.length);
  const noteEvents = dealNotes.map((row: RecordMap) => ({ id: `note-${row.id}`, created_at: row.created_at, title: row.is_internal ? 'Internal note added' : 'Shared note added', body: row.body || row.note, activity_type: 'note' }));
  const documentEvents = dealDocs.map((row: RecordMap) => ({ id: `document-${row.id}`, created_at: row.updated_at || row.created_at, title: `Document ${row.status || 'uploaded'}: ${row.label || row.file_name}`, body: row.review_notes || row.file_name, activity_type: 'document_event' }));
  const lenderEvents = dealSubmissions.map((row: RecordMap) => ({ id: `submission-${row.id}`, created_at: row.updated_at || row.created_at, title: `Funder ${row.status}: ${partnerName(row)}`, body: row.notes || row.decline_reason, activity_type: 'partner_submission' }));
  const taskEvents = dealTasks.map((row: RecordMap) => ({ id: `task-${row.id}`, created_at: row.updated_at || row.created_at, title: `Task ${row.status}: ${row.title}`, body: row.description, activity_type: 'task' }));
  const dealActivity = [...activities.filter((row: RecordMap) => row.deal_id === deal.id || row.resource_id === deal.id || (deal.application_id && row.application_id === deal.application_id)), ...noteEvents, ...documentEvents, ...lenderEvents, ...taskEvents].sort((a: RecordMap, b: RecordMap) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()).slice(0, 60);
  const openTasks = dealTasks.filter((task: RecordMap) => task.status !== 'completed');
  const overdueTasks = openTasks.filter((task: RecordMap) => task.due_date && new Date(task.due_date).getTime() < Date.now());
  const operatingSignals = getDealOperatingSignals(deal, dealDocs, positions, dealOffers, dealTasks);
  const recommendedSubmissionPartner = partnerMatches[0]?.partner || partners[0] || null;
  const recommendedPackageDocumentIds = defaultFunderPackageDocumentIds(dealDocs, recommendedSubmissionPartner);
  const recommendedPackageDocs = recommendedPackageDocumentIds.map((id) => dealDocs.find((doc: RecordMap) => doc.id === id)).filter(Boolean) as RecordMap[];
  const completedEliteApplication = recommendedPackageDocs.find((doc) => doc.document_type === 'completed_application' || doc.application_variant === 'elite_converted_partner' || doc.application_variant === 'elite_generated') || convertedApplicationDocs[0];
  const requiredFunderDocTypes = lenderRequiredDocTypes(recommendedSubmissionPartner);
  const missingFunderDocTypes = recommendedSubmissionPartner ? requiredFunderDocTypes.filter((type) => !bestDocumentForType(dealDocs, type)) : [];
  const packageBytes = recommendedPackageDocs.reduce((sum, doc) => sum + Number(doc.file_size || 0), 0);
  const submissionBlockers = [
    ...submissionReadiness.missing.slice(0, 6).map((item) => item.name),
    ...submissionReadiness.rejected.slice(0, 4).map((item) => `${item.name} rejected`),
    !completedEliteApplication && !app ? 'No application data available to generate the Elite application PDF' : '',
    recommendedSubmissionPartner && !(recommendedSubmissionPartner.submission_email || recommendedSubmissionPartner.email) ? 'Recommended funder has no submission email' : '',
  ].filter(Boolean);
  const submissionWarnings = [
    ...missingFunderDocTypes.slice(0, 5).map((type) => `${detailDocTypeLabel(type)} missing for ${recommendedSubmissionPartner?.name || 'selected funder'}`),
    packageBytes > 22 * 1024 * 1024 ? 'Package is near Gmail attachment size limits' : '',
    dealSubmissions.length ? `${dealSubmissions.length} funder submission(s) already logged` : '',
    selectedPartnerDefaultEvents.length ? 'Prior default risk exists for selected funder' : '',
  ].filter(Boolean);
  const submissionCockpitStatus = submissionBlockers.length ? 'Needs work' : submissionWarnings.length ? 'Review before send' : 'Ready to send';
  const nextAction = !internalUser ? (missingDocItems.length ? `Upload ${missingDocItems[0]?.name || 'missing documents'}` : 'Monitor status') : submissionReadiness.score < 90 ? `Request ${submissionReadiness.missing[0]?.name || 'missing documents'}` : dealSubmissions.length === 0 ? 'Submit to funders' : dealOffers.length === 0 ? `Follow up with ${partnerName(dealSubmissions[0])}` : !dealOffers.some((row: RecordMap) => row.status === 'accepted') ? 'Present offer to merchant' : fundingReadiness.score < 90 ? `Collect ${fundingReadiness.missing[0]?.name || 'remaining funding stips'}` : deal.stage_slug !== 'funded' ? 'Mark deal funded' : 'Monitor renewal eligibility';

  const logActivity = async (activity_type: string, title: string, body?: string | null) => {
    console.debug('Activity logging is handled by server APIs.', { activity_type, title, body });
  };

  const resetDocumentDialog = () => { setDocumentFiles([]); setDocumentDescription(''); setDocumentLabel(''); setDocumentType('auto'); setDocumentUploadProgress(''); };
  const resetPartnerApplicationDialog = () => { setPartnerApplicationFile(null); setPartnerApplicationSource(''); setPartnerApplicationNotes(''); };

  const uploadDealDocument = async () => {
    if (!documentFiles.length) { toast.error('Please select at least one document.'); return; }
    const invalidFile = invalidDealDocumentFile(documentFiles);
    if (invalidFile) { toast.error(`${invalidFile.name} must be a PDF, JPG, PNG, or HEIC file up to 10MB.`); return; }
    setUploadingDocument(true);
    try {
      const uploadedTypes: string[] = [];
      for (let index = 0; index < documentFiles.length; index += 1) {
        const file = documentFiles[index];
        setDocumentUploadProgress(`Uploading ${index + 1} of ${documentFiles.length}: ${file.name}`);
        const formData = new FormData();
        formData.set('file', file);
        formData.set('review_notes', documentDescription);
        if (documentLabel.trim()) formData.set('label', documentFiles.length > 1 ? `${documentLabel.trim()} (${index + 1})` : documentLabel.trim());
        if (documentType !== 'auto') formData.set('document_type', documentType);
        const response = await fetch(`/api/crm/deals/${deal.id}/documents`, { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || `Failed to upload ${file.name}`);
        const classifiedType = result.document?.document_type || result.classification?.document_type;
        if (classifiedType) uploadedTypes.push(detailDocTypeLabel(classifiedType));
      }
      toast.success(documentFiles.length > 1 ? `${documentFiles.length} documents uploaded` : uploadedTypes[0] ? `Document uploaded as ${uploadedTypes[0]}` : 'Deal document uploaded');
      setDocumentDialogOpen(false); resetDocumentDialog(); reload();
    } catch (error: any) { toast.error(error.message || 'Failed to upload document'); } finally { setUploadingDocument(false); }
  };

  const uploadPartnerApplication = async () => {
    if (!partnerApplicationFile) { toast.error('Please select a partner application file.'); return; }
    const extension = partnerApplicationFile.name.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'doc', 'docx', 'csv'];
    if (partnerApplicationFile.size > 15 * 1024 * 1024 || !allowedExtensions.includes(extension)) {
      toast.error('Supported files: PDF, image, DOC/DOCX, or CSV up to 15MB.');
      return;
    }
    setUploadingPartnerApplication(true);
    try {
      const formData = new FormData();
      formData.set('file', partnerApplicationFile);
      formData.set('source_partner_name', partnerApplicationSource);
      formData.set('notes', partnerApplicationNotes);
      const response = await fetch(`/api/crm/deals/${deal.id}/partner-applications`, { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Failed to upload partner application');
      const partnerApplication = result.partnerApplication || {};
      setRecentPartnerApplicationBundles((current) => {
        const bundle = {
          deal_id: partnerApplication.deal_id || deal.id,
          application_id: result.applicationId || partnerApplication.application_id || deal.application_id || null,
          partnerApplication,
          documents: [result.document, result.convertedDocument].filter(Boolean),
        };
        return [bundle, ...current.filter((item) => item.partnerApplication?.id !== partnerApplication.id)];
      });
      toast.success(result.convertedDocument ? 'Partner application converted and ready for funders' : 'Partner application uploaded. Review fields before generating the Elite application.');
      setPartnerApplicationDialogOpen(false);
      resetPartnerApplicationDialog();
      setDealDetailTab('documents');
      await reload();
    } catch (error: any) { toast.error(error.message || 'Failed to upload partner application'); } finally { setUploadingPartnerApplication(false); }
  };

  const generateEliteApplicationPdf = async (partnerApplicationId?: string) => {
    setGeneratingApplicationPdf(true);
    try {
      const response = await fetch(`/api/crm/deals/${deal.id}/applications/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_application_id: partnerApplicationId || null }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to generate Elite application PDF');
      toast.success('Elite application PDF generated');
      reload();
    } catch (error: any) { toast.error(error.message || 'Unable to generate Elite application PDF'); } finally { setGeneratingApplicationPdf(false); }
  };

  const openPartnerApplicationReview = (partnerApplication: RecordMap) => {
    setReviewingPartnerApplication(partnerApplication);
    setPartnerApplicationReviewOpen(true);
  };

  const savePartnerApplicationFields = async (partnerApplication: RecordMap, payload: RecordMap, notesValue: string, regeneratePdf: boolean) => {
    const response = await fetch(`/api/crm/partner-applications/${partnerApplication.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edited_payload: payload, status: regeneratePdf ? 'converted' : 'draft_ready', notes: notesValue, regenerate_pdf: regeneratePdf }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to save partner application fields'); return; }
    toast.success(regeneratePdf ? 'Elite application regenerated and ready for funders' : 'Partner application review saved');
    setPartnerApplicationReviewOpen(false);
    setReviewingPartnerApplication(null);
    reload();
  };

  const sendApplicationLink = async () => {
    setSendingApplicationLink(true);
    setGeneratedApplicationLink('');
    try {
      const response = await fetch(`/api/crm/deals/${deal.id}/application-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: applicationLinkEmail, message: applicationLinkMessage }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to create application link');
      setGeneratedApplicationLink(result.applicationUrl || '');
      if (result.emailStatus === 'sent') toast.success('Application link sent');
      else if (result.emailStatus === 'failed') toast.warning('Link created, but email failed. Copy the link manually.');
      else toast.success('Application link created');
      reload();
    } catch (error: any) { toast.error(error.message || 'Unable to create application link'); } finally { setSendingApplicationLink(false); }
  };

  const requestMissingItems = async () => {
    if (!missingDocItems.length) { toast.success('No missing required items to request.'); return; }
    setRequestingMissingDocs(true);
    try {
      const response = await fetch(`/api/crm/deals/${deal.id}/missing-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: deal.businesses?.email || '',
          items: missingDocItems.slice(0, 12).map((item) => ({ document_type: item.documentType, label: item.name, category: item.category, notes: item.notes || '' })),
          message: `Please complete the secure request for ${businessName(deal)} so we can continue funding review.`,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to request missing items');
      setGeneratedApplicationLink(result.applicationUrl || '');
      if (result.emailStatus === 'sent') toast.success('Missing-items request sent');
      else if (result.emailStatus === 'failed') toast.warning('Request created, but email failed. Copy the generated link manually.');
      else toast.success('Missing-items request created');
      reload();
    } catch (error: any) { toast.error(error.message || 'Unable to request missing items'); } finally { setRequestingMissingDocs(false); }
  };

  const openLenderSubmission = () => {
    const partnerId = recommendedSubmissionPartner?.id || '';
    const partner = partners.find((row: RecordMap) => row.id === partnerId);
    setSubmissionPartnerIds(partnerId ? [partnerId] : []);
    setSubmissionDocumentIds(defaultFunderPackageDocumentIds(dealDocs, partner));
    setSubmissionNotes(buildDefaultFunderMessage(deal, defaultFunderPackageDocumentIds(dealDocs, partner).map((id) => dealDocs.find((doc: RecordMap) => doc.id === id)).filter(Boolean) as RecordMap[], submissionReadiness, partner));
    setSubmissionDialogOpen(true);
  };

  const toggleSubmissionPartner = (partnerId: string, checked: boolean) => {
    const nextPartnerIds = checked
      ? Array.from(new Set([...submissionPartnerIds, partnerId]))
      : submissionPartnerIds.filter((id) => id !== partnerId);
    const nextPartners = partners.filter((row: RecordMap) => nextPartnerIds.includes(row.id));
    const messagePartner = nextPartners.length === 1 ? nextPartners[0] : null;
    const nextDocumentIds = nextPartners.length
      ? Array.from(new Set(nextPartners.flatMap((partner: RecordMap) => defaultFunderPackageDocumentIds(dealDocs, partner))))
      : defaultFunderPackageDocumentIds(dealDocs, null);
    setSubmissionPartnerIds(nextPartnerIds);
    setSubmissionDocumentIds(nextDocumentIds);
    setSubmissionNotes(buildDefaultFunderMessage(deal, nextDocumentIds.map((id) => dealDocs.find((doc: RecordMap) => doc.id === id)).filter(Boolean) as RecordMap[], submissionReadiness, messagePartner));
  };

  const revealSensitiveApplicationData = async () => {
    if (!app?.id) { toast.error('No application is linked to this deal yet.'); return; }
    setRevealingSensitiveData(true);
    try {
      const response = await fetch(`/api/crm/applications/${app.id}/sensitive`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to reveal sensitive fields');
      setRevealedSensitiveData(result.data || null);
      toast.success('Sensitive application data revealed');
    } catch (error: any) { toast.error(error.message || 'Unable to reveal sensitive fields'); } finally { setRevealingSensitiveData(false); }
  };

  const updateDocumentStatus = async (doc: RecordMap, status: string, reason?: string) => {
    if (!canUpdateDocuments) { toast.error('Only internal staff can change document review status.'); return; }
    const response = await fetch(`/api/documents/${doc.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, review_notes: reason || doc.review_notes || null }) });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to update document'); return; }
    await logActivity('document_event', `Document status changed: ${doc.label || doc.file_name}`, `${doc.status || 'uploaded'} → ${status}${reason ? ` · ${reason}` : ''}`);
    toast.success('Document updated'); reload();
  };

  const updateChecklistItem = async (item: ChecklistItem, status: string) => {
    if (!internalUser) { toast.error('Only internal staff can update checklist status.'); return; }
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

  const submitToLender = async () => {
    if (!canSendToLenders) { toast.error('Only admins and sales reps can send deals to funders.'); return; }
    const fundingPartnerIds = submissionPartnerIds.length ? submissionPartnerIds : [partnerMatches[0]?.partner?.id || partners[0]?.id].filter(Boolean);
    if (!fundingPartnerIds.length) { toast.error('Add a funding partner before submitting.'); return; }
    const selectedDuplicatePartners = partners.filter((partner: RecordMap) =>
      fundingPartnerIds.includes(partner.id) &&
      dealSubmissions.some((row: RecordMap) => row.funding_partner_id === partner.id && isActiveFunderSubmissionStatus(row.status))
    );
    const duplicatePartnerIds = new Set(selectedDuplicatePartners.map((partner: RecordMap) => partner.id));
    const confirmedDuplicateSend = selectedDuplicatePartners.length
      ? window.confirm(`This deal already has active submissions for ${selectedDuplicatePartners.map((partner: RecordMap) => partner.name).join(', ')}. Send again anyway?`)
      : false;
    if (selectedDuplicatePartners.length && !confirmedDuplicateSend) return;
    if (!submissionNotes.trim()) { toast.error('Add a funder message before sending.'); return; }
    setSavingSubmission(true);
    try {
      const results = [];
      for (const fundingPartnerId of fundingPartnerIds) {
        const response = await fetch(`/api/crm/deals/${deal.id}/lender-submissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funding_partner_id: fundingPartnerId,
            custom_message: submissionNotes,
            attachment_document_ids: submissionDocumentIds,
            confirm_duplicate_send: confirmedDuplicateSend && duplicatePartnerIds.has(fundingPartnerId),
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Failed to submit deal to funder');
        results.push({ partner: partners.find((row: RecordMap) => row.id === fundingPartnerId), result });
      }
      results.flatMap((item) => item.result.warnings || []).forEach((warning: string) => toast.warning(warning));
      const manualDraft = results.find((item) => item.result.emailDeliveryStatus !== 'sent' && item.result.emailDraft?.to)?.result.emailDraft;
      if (manualDraft) {
        const mailto = `mailto:${manualDraft.to}?subject=${encodeURIComponent(manualDraft.subject)}&body=${encodeURIComponent(manualDraft.body)}`;
        window.location.href = mailto;
      }
      const sentCount = results.filter((item) => item.result.emailDeliveryStatus === 'sent').length;
      toast.success(fundingPartnerIds.length > 1 ? `${sentCount}/${fundingPartnerIds.length} funder email(s) sent; ${fundingPartnerIds.length - sentCount} logged for follow-up.` : sentCount ? `Funder email sent${results[0]?.partner?.name ? ` to ${results[0].partner.name}` : ''}` : `Funder submission logged${results[0]?.partner?.name ? ` for ${results[0].partner.name}` : ''}`);
      setSubmissionDialogOpen(false); setSubmissionPartnerIds([]); setSubmissionNotes(''); setSubmissionDocumentIds([]); reload();
    } catch (error: any) { toast.error(error.message || 'Failed to submit deal to funder'); } finally { setSavingSubmission(false); }
  };

  const updateSubmission = async (submission: RecordMap, updates: RecordMap) => {
    const response = await fetch(`/api/crm/partner-submissions/${submission.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to update funder submission'); return; }
    await logActivity('partner_submission', `Funder status changed: ${partnerName(submission)}`, updates.status ? `${submission.status} → ${updates.status}` : updates.notes || updates.decline_reason || 'Submission updated');
    toast.success('Funder submission updated'); reload();
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

  return (
    <PageFrame title={businessName(deal)} subtitle={`Deal ${shortId(deal.id)} · ${stageLabel(deal.stage_slug)}`} actions={<Link href="/crm/deals" className="text-sm font-semibold text-[#0F2B5B]">Back to deals</Link>}>
      <CrmCard className="p-4">
        <div className="mb-4 flex flex-col gap-3 border-b border-[#E2E8F0] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[#64748B]">Current stage</p>
            {internalUser ? <div className="mt-1"><Select value={normalizeStage(deal.stage_slug)} onValueChange={updateStage}><SelectTrigger data-testid="deal-detail-stage" className="h-10 w-full rounded-[7px] md:w-[220px]"><SelectValue /></SelectTrigger><SelectContent>{STAGE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div> : <div className="mt-1"><StatusBadge value={stageLabel(deal.stage_slug)} /></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canUploadDocuments && <Button size="sm" variant="outline" className="h-9 rounded-[7px]" onClick={() => setDocumentDialogOpen(true)}><Upload className="mr-1 h-3.5 w-3.5" />Upload document</Button>}
            {canSendToLenders && <Button data-testid="deal-submit-lender-top" size="sm" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={openLenderSubmission}><Send className="mr-1 h-3.5 w-3.5" />Send to Funder</Button>}
          </div>
        </div>
        <Tabs value={dealDetailTab} onValueChange={setDealDetailTab}><TabsList className="mb-4 flex h-auto flex-wrap justify-start rounded-[8px] bg-[#F1F5F9] p-1">{[['overview','Overview'],['documents','Documents'],['lenders','Funders Sent To'],['offers','Offers'],['finance','Finance'],['history','History'],['activity','Activity'],['ai','AI Analysis']].map(([value, label]) => <TabsTrigger key={value} value={value} className="rounded-[6px]">{label}</TabsTrigger>)}</TabsList>
          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-2">
              {repeatDeals.length > 0 && <div className="lg:col-span-2 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><b>Repeat merchant:</b> {repeatDeals.length} prior submission(s) found. {dealRiskEvents.some((event: RecordMap) => event.event_type === 'defaulted') ? 'Prior default history exists.' : ''}</div>}
              <CrmCard className="p-4">
                <h3 className="text-sm font-semibold text-[#0F172A]">Business info</h3>
                <div className="mt-3"><InfoGrid rows={[["Legal name", deal.businesses?.legal_name || businessName(deal)], ["DBA", deal.businesses?.dba || 'None'], ["Industry", deal.businesses?.industry || 'Not set'], ["Phone", deal.businesses?.phone || 'Not set'], ["Email", deal.businesses?.email || 'Not set'], ["Address", [deal.businesses?.address, deal.businesses?.city, deal.businesses?.state, deal.businesses?.zip].filter(Boolean).join(', ') || 'Not set'], ["Monthly revenue", currency(deal.businesses?.monthly_gross_revenue)], ["Requested amount", currency(deal.requested_amount)], ["Assigned rep", repName(deal)], ["EIN", revealedSensitiveData?.business?.ein || app?.application_payload?.ein || (deal.businesses?.ein_last4 ? `***-**${deal.businesses.ein_last4}` : 'Not set')]]} /></div>
              </CrmCard>
              <CrmCard className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Owner info</h3>
                </div>
                <div className="mt-3 grid gap-3">
                  {displayOwners.length ? displayOwners.slice(0, 2).map((owner: RecordMap, index: number) => (
                    <div key={owner.id || index} className="rounded-[8px] border border-[#E2E8F0] p-3">
                      <InfoGrid rows={[["Name", [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.full_name || 'Not set'], ["Cell phone", owner.phone || 'Not set'], ["Email", owner.email || 'Not set'], ["Home address", [owner.address || owner.home_address, owner.city, owner.state, owner.zip].filter(Boolean).join(', ') || 'Not set'], ["Ownership", owner.ownership_percentage ? `${owner.ownership_percentage}%` : 'Not set'], ["SSN", sensitiveOwnersById[owner.id]?.ssn || owner.ssn || (owner.ssn_last4 || owner.ssn_last_four ? `***-**-${owner.ssn_last4 || owner.ssn_last_four}` : 'Not set')], ["DOB", sensitiveOwnersById[owner.id]?.dob || owner.dob || 'Not set']]} />
                    </div>
                  )) : <EmptyState title="No owner on file yet." body="Owner details are captured from the application or can be added from the partner application review." />}
                </div>
              </CrmCard>
              <CrmCard className="p-4 lg:col-span-2" data-testid="overview-funders-sent">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Funders sent</h3>
                  {canSendToLenders && <Button size="sm" className="h-8 rounded-[7px] bg-[#0F2B5B]" onClick={openLenderSubmission}><Send className="mr-1 h-3 w-3" />Send to Funder</Button>}
                </div>
                <div className="mt-3">
                  <SimpleRows rows={dealSubmissions} empty="No funder submissions yet. Use Send to Funder when the package is ready." render={(row) => {
                    const relatedOffer = dealOffers.find((o: RecordMap) => o.partner_submission_id === row.id || o.funding_partner_id === row.funding_partner_id);
                    const sentDocs = Array.isArray(row.attachment_document_ids) ? row.attachment_document_ids.map((id: string) => dealDocs.find((doc: RecordMap) => doc.id === id)).filter((doc: RecordMap | undefined): doc is RecordMap => Boolean(doc)) : [];
                    return (
                      <div className="grid gap-2 md:grid-cols-[1.2fr_130px_1fr_1fr]">
                        <div><b>{partnerName(row)}</b><p className="text-xs text-[#64748B]">Sent {date(row.submitted_at || row.created_at)}</p><p className="text-xs text-[#64748B]">{row.email_status === 'sent' || row.email_sent_at ? 'Email delivered via Gmail' : 'Logged - manual email follow-up'}</p></div>
                        <div><StatusBadge value={row.status || 'submitted'} /></div>
                        <div className="text-xs text-[#334155]"><p className="font-semibold text-[#64748B] uppercase text-[10px]">Notes</p><p>{row.notes || 'None'}</p></div>
                        <div className="text-xs text-[#334155]">
                          <p className="font-semibold text-[#64748B] uppercase text-[10px]">Offer / response</p>
                          <p>{relatedOffer ? `${currency(relatedOffer.approved_amount)} · ${relatedOffer.factor_rate || 'N/A'} factor` : row.decline_reason || 'No response yet'}</p>
                          {sentDocs.length > 0 && <p className="mt-1 text-[#64748B]">Docs sent: {sentDocs.slice(0, 4).map((doc: RecordMap) => doc.label || doc.file_name).join(', ')}{sentDocs.length > 4 ? ` +${sentDocs.length - 4} more` : ''}</p>}
                        </div>
                      </div>
                    );
                  }} />
                </div>
              </CrmCard>
              <CrmCard className="p-4 lg:col-span-2" data-testid="overview-notes">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#0F172A]">Notes</h3>
                  {canAddNotes && <Button data-testid="deal-add-note" size="sm" className="h-8 rounded-[7px] bg-[#0F2B5B]" onClick={() => setNoteDialogOpen(true)}><Plus className="mr-1 h-3 w-3" />Add note</Button>}
                </div>
                <div className="mt-3">
                  <SimpleRows rows={dealNotes} empty={internalUser ? 'No notes yet. Add the first note for this deal.' : 'No shared notes yet.'} render={(row) => <div><b>{row.is_internal ? 'Internal note' : 'Shared note'}</b><p className="text-[#334155]">{row.body || row.note}</p><p className="text-xs text-[#64748B]">{date(row.created_at)}</p></div>} />
                </div>
              </CrmCard>
            </div>
          </TabsContent>
          <TabsContent value="documents">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Applications &amp; documents</p>
                <p className="text-xs text-[#64748B]">Completed, website, partner, and converted applications live here together with all supporting documents.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManageApplications && <Button data-testid="deal-upload-partner-application" variant="outline" className="h-9 rounded-[7px]" onClick={() => setPartnerApplicationDialogOpen(true)}><Upload className="mr-2 h-4 w-4" />Upload Partner Application</Button>}
                {canManageApplications && <Button data-testid="deal-generate-elite-application" variant="outline" className="h-9 rounded-[7px]" onClick={() => generateEliteApplicationPdf()} disabled={generatingApplicationPdf}><FileText className="mr-2 h-4 w-4" />{generatingApplicationPdf ? 'Generating...' : 'Generate Elite Application PDF'}</Button>}
                {canManageApplications && <Button data-testid="deal-send-application-link" variant="outline" className="h-9 rounded-[7px]" onClick={() => setApplicationLinkDialogOpen(true)}><Mail className="mr-2 h-4 w-4" />Send Application Link</Button>}
              </div>
            </div>
            {dealPartnerApplications.length > 0 && (
              <CrmCard className="mb-4 p-4">
                <h3 className="text-sm font-semibold text-[#0F172A]">Partner application uploads</h3>
                <div className="mt-3 grid gap-3">
                  {dealPartnerApplications.map((row: RecordMap) => {
                    const payload = row.edited_payload || row.extracted_payload || {};
                    return (
                      <div key={row.id} className="rounded-[8px] border border-[#E2E8F0] p-3 text-sm">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <b>{row.source_partner_name || 'Unknown partner'}</b>
                            <p className="text-xs text-[#64748B]">{row.original_file_name || 'Partner application'} · {date(row.created_at)} · {payload.company_name || payload.legal_name || businessName(deal)}</p>
                          </div>
                          <StatusBadge value={row.status || 'uploaded'} />
                        </div>
                        {canManageApplications && <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" className="h-8 bg-[#0F2B5B]" onClick={() => openPartnerApplicationReview(row)}><FileText className="mr-1 h-3 w-3" />Review &amp; Generate Elite PDF</Button></div>}
                      </div>
                    );
                  })}
                </div>
              </CrmCard>
            )}<div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div className="flex gap-2"><Select value={documentFilter} onValueChange={setDocumentFilter}><SelectTrigger className="h-9 w-[180px] rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All docs</SelectItem>{['uploaded','in_review','approved','rejected','needs_replacement','expired'].map((status) => <SelectItem key={status} value={status}>{status.replaceAll('_',' ')}</SelectItem>)}{DETAIL_DOCUMENT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-wrap gap-2">{internalUser && <Button data-testid="deal-request-missing-items" variant="outline" className="h-9 rounded-[7px]" onClick={requestMissingItems} disabled={requestingMissingDocs || !missingDocItems.length}>{requestingMissingDocs ? 'Requesting...' : 'Request Missing Items'}</Button>}<Button data-testid="deal-upload-document" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={() => setDocumentDialogOpen(true)}><Upload className="mr-2 h-4 w-4" />Upload / replace document</Button></div></div>{missingDocItems.length > 0 && <div className="mb-4 rounded-[8px] border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold text-amber-900">Missing required documents</p><div className="mt-2 flex flex-wrap gap-2">{missingDocItems.map((item) => <button key={item.id} className="rounded-[6px] border border-amber-300 bg-white px-2 py-1 text-xs text-amber-900" onClick={() => updateChecklistItem(item, 'requested')}>{item.name}</button>)}</div></div>}{groupedDocs.length ? <div className="grid gap-3">{groupedDocs.map((group) => <div key={group.type.value} className="rounded-[8px] border border-[#E2E8F0]"><div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold">{group.type.label}</div>{group.docs.map((row) => <div key={row.id} className="grid gap-2 border-b border-[#E2E8F0] p-3 text-sm last:border-b-0 md:grid-cols-[24px_1.4fr_1fr_120px_150px]"><span className="text-[#64748B]">{fileIcon(row.file_name)}</span><b>{row.file_name || row.label}<span className="ml-2 text-xs font-normal text-[#64748B]">{row.label && row.label !== row.file_name ? `${row.label} · ` : ''}{formatBytes(row.file_size)}</span></b><StatusBadge value={row.status} /><span>{date(row.updated_at || row.created_at)}</span><span className="flex flex-wrap gap-1"><Button size="sm" variant="outline" className="h-8" onClick={() => openDealDocument(row, 'preview')}><Eye className="mr-1 h-3 w-3" />Preview</Button><Button size="sm" variant="outline" className="h-8" onClick={() => openDealDocument(row, 'download')}><Download className="h-3 w-3" /></Button></span></div>)}</div>)}</div> : <EmptyState title="No documents attached." body="Upload documents here so this deal page remains the source of truth." />}</TabsContent>
          <TabsContent value="lenders"><div className="mb-3 flex justify-end">{canSendToLenders ? <Button data-testid="deal-submit-lender" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={openLenderSubmission}><Send className="mr-2 h-4 w-4" />Send to Funder</Button> : <Button data-testid="deal-submit-lender-disabled" className="h-9 rounded-[7px]" variant="outline" disabled>Only admins and sales reps can send</Button>}</div><SimpleRows rows={dealSubmissions} empty="No funder submissions yet." render={(row) => { const relatedOffer = dealOffers.find((o: RecordMap) => o.partner_submission_id === row.id || o.funding_partner_id === row.funding_partner_id); return <div className="grid gap-3 md:grid-cols-[1.2fr_170px_1fr_1fr_220px]"><div><b>{partnerName(row)}</b><p className="text-xs text-[#64748B]">{row.funding_partners?.submission_email || row.funding_partners?.portal_url || 'No route saved'}</p><p className="text-xs text-[#64748B]">Sent {date(row.submitted_at || row.created_at)} · Updated {date(row.updated_at)}</p></div><Select value={row.status || 'draft'} onValueChange={(status) => updateSubmission(row, { status })}><SelectTrigger data-testid={`lender-status-${row.id}`} className="h-9 rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent>{['draft','submitted','in_review','more_info_needed','approved','declined','withdrawn','funded'].map((status) => <SelectItem key={status} value={status}>{status.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select><div><p>{row.notes || 'No funder notes'}</p><Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => updateSubmission(row, { notes: window.prompt('Funder notes', row.notes || '') || row.notes })}>Edit notes</Button></div><div><p>{row.decline_reason || row.conditions || 'No decline reason / stips'}</p><Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => updateSubmission(row, { decline_reason: window.prompt('Decline reason or conditions', row.decline_reason || '') || row.decline_reason })}>Add reason/stips</Button></div><div>{relatedOffer ? <div><b>{currency(relatedOffer.approved_amount)}</b><p>{relatedOffer.factor_rate || 'N/A'} factor · {relatedOffer.term_days || 'N/A'} days</p><StatusBadge value={relatedOffer.status} /></div> : <Button size="sm" className="h-8 bg-[#0F2B5B]" onClick={() => convertSubmissionToOffer(row)}>Convert to offer</Button>}</div></div>; }} /></TabsContent>
          <TabsContent value="offers"><div data-testid="offer-comparison-view">{dealOffers.length ? <><div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{offerInsights.highlights.map(([label, value]) => <CrmCard key={label} className="p-3"><p className="text-[11px] font-semibold uppercase text-[#64748B]">{label}</p><p className="mt-1 text-sm font-semibold text-[#0F172A]">{value}</p></CrmCard>)}</div><div className="grid gap-3 md:grid-cols-2">{dealOffers.map((row: RecordMap) => <CrmCard key={row.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><b>{partnerName(row)}</b><p className="text-xs text-[#64748B]">Expires {date(row.expires_at)}</p></div>{offerInsights.recommended?.id === row.id && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Recommended Offer</span>}</div><InfoGrid rows={[["Approved", currency(row.approved_amount)], ["Factor", row.factor_rate || 'N/A'], ["Buy / sell", `${row.buy_rate || 'N/A'} / ${row.sell_rate || 'N/A'}`], ["Payback", currency(row.payback_amount)], ["Term", `${row.term_days || 'N/A'} days`], ["Payment", currency(row.daily_payment || row.weekly_payment)], ["Frequency", row.payment_frequency || 'N/A'], ["Net funding", currency(row.net_funding_amount || row.approved_amount)], ["Holdback", pct(row.holdback_pct)], ["Origination fee", currency(row.origination_fee)], ["Broker commission", `${row.broker_commission_pct || 0}%`], ["ISO commission", `${row.iso_commission_pct || 0}%`], ["Stips", Array.isArray(row.stips_required) && row.stips_required.length ? row.stips_required.join(', ') : 'None'], ["Status", <StatusBadge key="status" value={row.status} />], ["Notes", row.notes || 'None']]} /></CrmCard>)}</div></> : <EmptyState title="No offers received yet." body="Convert lender responses into offers to compare terms and recommendations." />}</div></TabsContent>
          <TabsContent value="finance"><div className="grid gap-4"><InfoGrid rows={[["Funded amount", currency(deal.funded_amount)], ["Referral partner split", `${deal.referral_partner_commission_pct ?? 20}%`], ["Junior closer split", `${deal.junior_closer_commission_pct ?? 5}%`], ["Senior closer split", `${deal.senior_closer_commission_pct ?? 10}%`], ["Clawback amount", currency(deal.commission_clawback_amount)], ["Default status", deal.defaulted_at ? `Defaulted ${date(deal.defaulted_at)}` : 'No default recorded']]} /><div className="grid gap-4 lg:grid-cols-2"><CrmCard className="p-4"><h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Commission recipients</h3><div className="mb-3 grid gap-2 md:grid-cols-2"><Input placeholder="Recipient name" value={commissionForm.recipient_name || ''} onChange={(e) => setCommissionForm({ ...commissionForm, recipient_name: e.target.value })} /><Select value={commissionForm.recipient_type || 'referral_partner'} onValueChange={(value) => setCommissionForm({ ...commissionForm, recipient_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['referral_partner','junior_closer','senior_closer','broker','sales_rep','processor','other'].map((type) => <SelectItem key={type} value={type}>{type.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select><Input placeholder="Percent" value={commissionForm.percentage || ''} onChange={(e) => setCommissionForm({ ...commissionForm, percentage: e.target.value })} /><Input placeholder="Flat amount optional" value={commissionForm.flat_amount || ''} onChange={(e) => setCommissionForm({ ...commissionForm, flat_amount: e.target.value })} /><Input className="md:col-span-2" placeholder="Notes" value={commissionForm.notes || ''} onChange={(e) => setCommissionForm({ ...commissionForm, notes: e.target.value })} /><Button className="bg-[#0F2B5B]" onClick={saveCommissionRecipient}>Add recipient</Button></div><SimpleRows rows={dealCommissionRecipients.length ? dealCommissionRecipients : dealCommissions} empty="No commissions tracked for this deal yet." render={(row) => <div className="grid gap-2 md:grid-cols-[1fr_120px_140px_120px]"><b>{row.recipient_name || row.notes || row.payment_status || 'Commission'}</b><span>{Number(row.percentage ?? row.commission_pct ?? 0).toFixed(2)}%</span><span>{currency(row.flat_amount || row.commission_amount)}</span><StatusBadge value={row.payout_status || row.payment_status || 'pending'} /></div>} /></CrmCard><CrmCard className="p-4"><h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Risk and default events</h3><div className="mb-3 grid gap-2 md:grid-cols-2"><Select value={riskForm.event_type || 'defaulted'} onValueChange={(value) => setRiskForm({ ...riskForm, event_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['funded','defaulted','closed_not_funded','clawback','risk_note'].map((type) => <SelectItem key={type} value={type}>{type.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select><Select value={riskForm.funding_partner_id || 'none'} onValueChange={(value) => setRiskForm({ ...riskForm, funding_partner_id: value === 'none' ? '' : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No funder</SelectItem>{partners.map((partner: RecordMap) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}</SelectContent></Select><Input placeholder="Amount optional" value={riskForm.amount || ''} onChange={(e) => setRiskForm({ ...riskForm, amount: e.target.value })} /><Input placeholder="Notes" value={riskForm.notes || ''} onChange={(e) => setRiskForm({ ...riskForm, notes: e.target.value })} /><Button className="bg-[#0F2B5B]" onClick={saveRiskEvent}>Record event</Button></div><SimpleRows rows={dealRiskEvents} empty="No risk history yet." render={(row) => <div className="grid gap-2 md:grid-cols-[1fr_1fr_120px]"><b>{row.event_type?.replaceAll('_',' ')}</b><span>{row.funding_partners?.name || row.notes || 'No lender'}</span><span>{date(row.event_date || row.created_at)}</span></div>} /></CrmCard></div></div></TabsContent>
          <TabsContent value="history"><div data-testid="merchant-history-view" className="grid gap-3"><div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#334155]">Merchant history is grouped by business match and repeat-submission linkage. Review prior funder outcomes and default events before packaging this file.</div><SimpleRows rows={historyDeals} empty="No prior submissions for this merchant." render={(historyDeal) => { const historySubmissions = partnerSubmissions.filter((row: RecordMap) => row.deal_id === historyDeal.id); const historyRisk = riskEvents.filter((row: RecordMap) => row.deal_id === historyDeal.id || row.business_id === historyDeal.business_id); const historyNotes = notes.filter((row: RecordMap) => row.deal_id === historyDeal.id).slice(0, 2); return <div data-testid={`merchant-history-${historyDeal.id}`} className="grid gap-3 md:grid-cols-[1.1fr_1fr_1fr_1fr]"><div><b>{businessName(historyDeal)} #{historyDeal.submission_sequence || historyDeals.indexOf(historyDeal) + 1}</b><p className="text-xs text-[#64748B]">Created {date(historyDeal.created_at)} · {stageLabel(historyDeal.stage_slug)}</p></div><div><p className="text-xs font-semibold uppercase text-[#64748B]">Funding</p><p>{historyDeal.funded_at || Number(historyDeal.funded_amount || 0) > 0 ? `Funded ${currency(historyDeal.funded_amount)}` : 'Not funded'}</p></div><div><p className="text-xs font-semibold uppercase text-[#64748B]">Funders</p><p>{historySubmissions.length ? historySubmissions.map((row: RecordMap) => `${partnerName(row)} (${row.status || 'submitted'})`).join(', ') : 'No funder submissions'}</p></div><div><p className="text-xs font-semibold uppercase text-[#64748B]">Risk and notes</p><p>{historyRisk.length ? historyRisk.map((row: RecordMap) => `${row.event_type?.replaceAll('_',' ')}${row.funding_partners?.name ? ` with ${row.funding_partners.name}` : ''}`).join(', ') : 'No risk events'}</p>{historyNotes.map((row: RecordMap) => <p key={row.id} className="mt-1 text-xs text-[#64748B]">{row.body || row.note}</p>)}</div></div>; }} /></div></TabsContent>
          <TabsContent value="activity"><SimpleRows rows={dealActivity} empty="No activity yet." render={(row) => <div><b>{row.title || row.action || 'Activity'}</b><p className="text-[#334155]">{row.body}</p><p className="text-xs text-[#64748B]">{row.activity_type ? `${row.activity_type.replaceAll('_', ' ')} · ` : ''}{date(row.created_at)}{row.performed_by ? ` · User ${shortId(row.performed_by)}` : ''}</p></div>} /></TabsContent>
          <TabsContent value="ai"><DealAiAnalysisPlaceholder dealId={deal.id} /></TabsContent>
        </Tabs>
      </CrmCard>
      <Dialog open={documentDialogOpen} onOpenChange={(open) => { setDocumentDialogOpen(open); if (!open) resetDocumentDialog(); }}><DialogContent className="max-w-xl rounded-[8px]"><DialogHeader><DialogTitle>Upload deal documents</DialogTitle></DialogHeader><div className="grid gap-4"><div><Label className="text-xs text-[#64748B]">Document files</Label><Input data-testid="deal-document-file" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" onChange={(event) => setDocumentFiles(Array.from(event.target.files || []))} className="mt-1 rounded-[7px]" />{documentFiles.length > 0 && <div className="mt-2 grid gap-1 text-xs text-[#64748B]">{documentFiles.map((file) => <p key={`${file.name}-${file.size}`}>{file.name} · {formatBytes(file.size)}</p>)}</div>}{documentUploadProgress && <p className="mt-2 text-xs font-semibold text-[#0F2B5B]">{documentUploadProgress}</p>}</div><div><Label className="text-xs text-[#64748B]">Document name</Label><Input data-testid="deal-document-label" value={documentLabel} onChange={(event) => setDocumentLabel(event.target.value)} className="mt-1 rounded-[7px]" placeholder="Optional - e.g. March 2026 bank statement" /></div><div><Label className="text-xs text-[#64748B]">Document type</Label><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger data-testid="deal-document-type" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto-detect</SelectItem>{DETAIL_DOCUMENT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs text-[#64748B]">Description / replacement note</Label><Input data-testid="deal-document-description" value={documentDescription} onChange={(event) => setDocumentDescription(event.target.value)} className="mt-1 rounded-[7px]" placeholder="Optional document note" /></div></div><DialogFooter><Button variant="outline" onClick={() => setDocumentDialogOpen(false)}>Cancel</Button><Button data-testid="deal-save-document" onClick={uploadDealDocument} disabled={uploadingDocument || !documentFiles.length}>{uploadingDocument ? 'Uploading...' : documentFiles.length > 1 ? `Upload ${documentFiles.length} documents` : 'Upload document'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={partnerApplicationDialogOpen} onOpenChange={(open) => { setPartnerApplicationDialogOpen(open); if (!open) resetPartnerApplicationDialog(); }}><DialogContent className="max-w-xl rounded-[8px]"><DialogHeader><DialogTitle>Upload Partner Application</DialogTitle></DialogHeader><div className="grid gap-4"><div><Label className="text-xs text-[#64748B]">Application file</Label><Input data-testid="partner-application-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.doc,.docx,.csv" onChange={(event) => setPartnerApplicationFile(event.target.files?.[0] || null)} className="mt-1 rounded-[7px]" />{partnerApplicationFile && <p className="mt-1 text-xs text-[#64748B]">{partnerApplicationFile.name} · {formatBytes(partnerApplicationFile.size)}</p>}</div><div><Label className="text-xs text-[#64748B]">Source partner</Label><Input data-testid="partner-application-source" value={partnerApplicationSource} onChange={(event) => setPartnerApplicationSource(event.target.value)} className="mt-1 rounded-[7px]" placeholder="Funding partner or broker name" /></div><div><Label className="text-xs text-[#64748B]">Notes</Label><Textarea data-testid="partner-application-notes" value={partnerApplicationNotes} onChange={(event) => setPartnerApplicationNotes(event.target.value)} className="mt-1 min-h-[100px] rounded-[7px]" placeholder="What came in, missing fields, or conversion notes" /></div><div className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">Upload stores the original partner file on this deal and extracts application fields for review. Generate the Elite Funding Solutions PDF after the fields, sensitive values, and signature are confirmed.</div></div><DialogFooter><Button variant="outline" onClick={() => setPartnerApplicationDialogOpen(false)}>Cancel</Button><Button data-testid="save-partner-application" onClick={uploadPartnerApplication} disabled={uploadingPartnerApplication || !partnerApplicationFile}>{uploadingPartnerApplication ? 'Uploading...' : 'Upload for Review'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={partnerApplicationReviewOpen} onOpenChange={(open) => { setPartnerApplicationReviewOpen(open); if (!open) setReviewingPartnerApplication(null); }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto rounded-[8px]">
          <DialogHeader><DialogTitle>Elite Application Review</DialogTitle></DialogHeader>
          {reviewingPartnerApplication && (
            <PartnerApplicationReviewForm
              partnerApplication={reviewingPartnerApplication}
              onCancel={() => { setPartnerApplicationReviewOpen(false); setReviewingPartnerApplication(null); }}
              onSave={(payload, notesValue, regeneratePdf) => savePartnerApplicationFields(reviewingPartnerApplication, payload, notesValue, regeneratePdf)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={applicationLinkDialogOpen} onOpenChange={(open) => { setApplicationLinkDialogOpen(open); if (!open) { setGeneratedApplicationLink(''); setApplicationLinkMessage(''); } }}><DialogContent className="max-w-xl rounded-[8px]"><DialogHeader><DialogTitle>Send Application Link</DialogTitle></DialogHeader><div className="grid gap-4"><div><Label className="text-xs text-[#64748B]">Customer email</Label><Input data-testid="application-link-email" value={applicationLinkEmail} onChange={(event) => setApplicationLinkEmail(event.target.value)} className="mt-1 rounded-[7px]" placeholder={deal.businesses?.email || 'customer@email.com'} /></div><div><Label className="text-xs text-[#64748B]">Message</Label><Textarea data-testid="application-link-message" value={applicationLinkMessage} onChange={(event) => setApplicationLinkMessage(event.target.value)} className="mt-1 min-h-[100px] rounded-[7px]" placeholder="Optional note to include in the email" /></div>{generatedApplicationLink && <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm"><p className="text-xs font-semibold uppercase text-[#64748B]">Generated link</p><button className="mt-1 break-all text-left font-semibold text-[#0F2B5B]" onClick={() => navigator.clipboard?.writeText(generatedApplicationLink)}>{generatedApplicationLink}</button><p className="mt-1 text-xs text-[#64748B]">Click the link text to copy it.</p></div>}</div><DialogFooter><Button variant="outline" onClick={() => setApplicationLinkDialogOpen(false)}>Cancel</Button><Button data-testid="save-application-link" onClick={sendApplicationLink} disabled={sendingApplicationLink}>{sendingApplicationLink ? 'Creating...' : 'Create and send link'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}><DialogContent className="max-w-xl rounded-[8px]"><DialogHeader><DialogTitle>Add deal note</DialogTitle></DialogHeader><div className="grid gap-4"><div><Label className="text-xs text-[#64748B]">Note</Label><Textarea data-testid="deal-note-body" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} className="mt-1 min-h-[120px] rounded-[7px]" placeholder="Add underwriting, merchant, or document context..." /></div><label className="flex items-center gap-2 text-sm font-medium text-[#0F172A]"><input type="checkbox" checked={noteInternal} onChange={(event) => setNoteInternal(event.target.checked)} />Internal note</label></div><DialogFooter><Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button><Button data-testid="deal-save-note" onClick={saveDealNote} disabled={savingNote}>{savingNote ? 'Saving...' : 'Save note'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={submissionDialogOpen} onOpenChange={setSubmissionDialogOpen}>
        <DialogContent className="grid max-h-[calc(100vh-2rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] rounded-[8px]">
          <DialogHeader><DialogTitle>Submit deal to funders</DialogTitle></DialogHeader>
          <div className="grid gap-4 overflow-y-auto pr-1">
            <div>
              <Label className="text-xs text-[#64748B]">Funding partners</Label>
              <div data-testid="deal-submission-partners" className="mt-2 max-h-[180px] overflow-y-auto rounded-[8px] border border-[#E2E8F0]">
                {partners.length ? partners.map((partner: RecordMap) => (
                  <label key={partner.id} className="flex items-start gap-3 border-b border-[#E2E8F0] p-3 text-sm last:border-b-0">
                    <input
                      type="checkbox"
                      data-testid={`deal-submission-partner-${partner.id}`}
                      checked={submissionPartnerIds.includes(partner.id)}
                      onChange={(event) => toggleSubmissionPartner(partner.id, event.target.checked)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[#0F172A]">{partner.name}</span>
                      <span className="block text-xs text-[#64748B]">{partner.submission_email || partner.email || partner.portal_url || 'No route saved'}</span>
                    </span>
                    {dealSubmissions.some((row: RecordMap) => row.funding_partner_id === partner.id) && <span className="rounded-[6px] bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">Sent before</span>}
                  </label>
                )) : <p className="p-3 text-sm text-[#64748B]">No funding partners are configured yet.</p>}
              </div>
            </div>
            <div className="grid gap-2 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm md:grid-cols-3">
              <div><p className="text-[11px] font-semibold uppercase text-[#64748B]">Readiness</p><p className="mt-1 font-semibold text-[#0F172A]">{submissionReadiness.score}% · {submissionReadiness.status}</p></div>
              <div><p className="text-[11px] font-semibold uppercase text-[#64748B]">Selected package</p><p className="mt-1 font-semibold text-[#0F172A]">{submissionDocumentIds.length} attachment(s) · {submissionPartnerIds.length} funder(s)</p></div>
              <div><p className="text-[11px] font-semibold uppercase text-[#64748B]">Elite app</p><p className="mt-1 font-semibold text-[#0F172A]">{completedEliteApplication ? 'Included' : 'Generated if needed'}</p></div>
            </div>
            {selectedSubmissionPartners.some((partner: RecordMap) => !(partner.submission_email || partner.email)) && <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">One or more selected funders has no submission email. Those submissions will be logged for manual follow-up unless a route is added on the funder profile.</div>}
            {selectedSubmissionPartners.length > 0 && <div data-testid="lender-preset-summary" className={`rounded-[8px] border p-3 text-sm ${selectedPartnerMissingDocTypes.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}><b>Funder package preset:</b> {submissionDocumentIds.length} attachment(s) preselected for {selectedSubmissionPartners.length} funder(s). The completed Elite application is mandatory and all eligible deal documents are included by default. {selectedPartnerMissingDocTypes.length ? `Missing: ${selectedPartnerMissingDocTypes.map(detailDocTypeLabel).join(', ')}.` : 'Required package looks complete.'}</div>}
            {duplicateSubmissionPartners.length > 0 && <div data-testid="lender-duplicate-warning" className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><b>Already sent:</b> {duplicateSubmissionPartners.map((partner: RecordMap) => partner.name).join(', ')} already has an active submission. You will be asked to confirm before sending again.</div>}
            {selectedPartnerDefaultEvents.length > 0 && <div data-testid="lender-default-warning" className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-900"><b>Prior default with selected funder.</b><p className="mt-1">This merchant has {selectedPartnerDefaultEvents.length} default event(s) tied to selected funders. Review history before sending.</p></div>}
            <div><Label className="text-xs text-[#64748B]">Custom funder message</Label><Textarea data-testid="deal-submission-notes" value={submissionNotes} onChange={(event) => setSubmissionNotes(event.target.value)} className="mt-1 min-h-[120px] rounded-[7px]" placeholder="Explain deal specifics, negative days, cash-flow context, account quality, or funder-specific packaging notes." /></div>
            <div>
              <Label className="text-xs text-[#64748B]">Selected attachments</Label>
              <div className="mt-2 max-h-[220px] overflow-y-auto rounded-[8px] border border-[#E2E8F0]">
                {dealDocs.length ? dealDocs.map((doc: RecordMap) => (
                  <label key={doc.id} className="flex items-center gap-3 border-b border-[#E2E8F0] p-3 text-sm last:border-b-0">
                    <input type="checkbox" checked={submissionDocumentIds.includes(doc.id)} onChange={(event) => setSubmissionDocumentIds((current) => event.target.checked ? Array.from(new Set([...current, doc.id])) : current.filter((id) => id !== doc.id))} />
                    <span className="min-w-0 flex-1 truncate">{doc.file_name}</span>
                    <span className="text-xs text-[#64748B]">{detailDocTypeLabel(doc.document_type)}</span>
                    <StatusBadge value={doc.status || 'uploaded'} />
                  </label>
                )) : <p className="p-3 text-sm text-[#64748B]">No documents attached to this deal yet.</p>}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">The latest completed Elite application is included automatically. If none exists, the CRM generates one before sending. Eligible statements and support documents are selected by default.</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSubmissionDialogOpen(false)}>Cancel</Button><Button data-testid="deal-save-submission" onClick={submitToLender} disabled={savingSubmission || !submissionPartnerIds.length}>{savingSubmission ? 'Submitting...' : submissionPartnerIds.length > 1 ? `Send to ${submissionPartnerIds.length} Funders` : 'Send to Funder'}</Button></DialogFooter>
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
    { name: 'Submissions', value: rangedDeals.filter((row: RecordMap) => ['application_submitted', 'underwriting_review', 'approved', 'offers_received', 'offer_presented', 'contract_requested', 'contract_sent', 'contract_signed', 'funded'].includes(row.stage_slug)).length },
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
  const trustedReports = getCrmReportSourceOfTruth({ leads: rangedLeads, deals: rangedDeals, offers: rangedOffers, commissions: rangedCommissions, partners, users });
  const reportRows = [
    { name: 'Deals', value: rangedDeals.length, rows: rangedDeals },
    { name: 'Funding', value: currency(fundedDeals.reduce((sum: number, row: RecordMap) => sum + Number(row.funded_amount || 0), 0)), rows: fundedDeals },
    { name: 'Renewals', value: rangedRenewals.length, rows: rangedRenewals },
    { name: 'Earnings', value: currency(rangedCommissions.reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0)), rows: rangedCommissions },
    { name: 'User performance', value: users.length, rows: users.map((user: RecordMap) => ({ email: user.email, role: user.role, active: user.is_active, deals: rangedDeals.filter((deal: RecordMap) => deal.assigned_user_id === user.id).length, earnings: rangedCommissions.filter((row: RecordMap) => row.rep_id === user.id).reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0) })) },
    { name: 'Funding partner performance', value: partners.length, rows: partners.map((partner: RecordMap) => ({ name: partner.name, offers: rangedOffers.filter((offer: RecordMap) => offer.funding_partner_id === partner.id).length, approved_amount: rangedOffers.filter((offer: RecordMap) => offer.funding_partner_id === partner.id).reduce((sum: number, offer: RecordMap) => sum + Number(offer.approved_amount || 0), 0) })) },
    { name: 'Lead source conversion', value: trustedReports.sourceRows.length, rows: trustedReports.sourceRows },
    { name: 'Rep funded performance', value: trustedReports.repRows.length, rows: trustedReports.repRows },
    { name: 'Partner acceptance', value: trustedReports.partnerRows.length, rows: trustedReports.partnerRows },
    { name: 'Approved but not accepted', value: rangedOffers.filter((offer: RecordMap) => ['received', 'presented', 'approved'].includes(offer.status)).length, rows: rangedOffers.filter((offer: RecordMap) => ['received', 'presented', 'approved'].includes(offer.status)) },
  ];
  const exportPack = () => {
    exportCsv('crm-report-pack', reportRows.flatMap((report) => report.rows.map((row: RecordMap) => ({ report: report.name, ...row }))));
  };
  return (
    <PageFrame title="Reports" subtitle="Date-filtered MCA production, rep, partner, renewal, and earnings reports" actions={<div className="flex gap-2"><Select value={dateRange} onValueChange={setDateRange}><SelectTrigger className="h-9 w-[130px] rounded-[7px]"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30d">Last 30 days</SelectItem><SelectItem value="90d">Last 90 days</SelectItem><SelectItem value="all">All time</SelectItem></SelectContent></Select><Button className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={exportPack}><Download className="mr-2 h-4 w-4" />Export pack</Button></div>}>
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Pipeline Value" value={currency(trustedReports.pipelineValue)} subtitle="Open requested amount" icon={<Briefcase className="h-4 w-4" />} tone="#2563EB" />
        <MetricCard title="Funded Volume" value={currency(trustedReports.fundedVolume)} subtitle="Closed funding" icon={<TrendingUp className="h-4 w-4" />} tone="#059669" />
        <MetricCard title="Offer Conversion" value={pct(trustedReports.offerConversionRate)} subtitle="Deals reaching offer stage" icon={<Percent className="h-4 w-4" />} tone="#7C3AED" />
        <MetricCard title="Commission Forecast" value={currency(trustedReports.commissionForecast)} subtitle="Booked gross commissions" icon={<WalletCards className="h-4 w-4" />} tone="#C9A84C" />
        <MetricCard title="Source Channels" value={trustedReports.sourceRows.length} subtitle="Tracked lead origins" icon={<Database className="h-4 w-4" />} tone="#0F2B5B" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Pipeline Conversion</h2><ResponsiveContainer width="100%" height={290}><BarChart data={conversion}><CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#0F2B5B" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></CrmCard>
        <CrmCard className="p-4"><h2 className="text-sm font-semibold">Funded Volume Trend</h2><ResponsiveContainer width="100%" height={290}><LineChart data={monthly}><CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => currency(value)} /><Line type="monotone" dataKey="funded" stroke="#C9A84C" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></CrmCard>
      </div>
      <CrmCard className="mt-4 overflow-x-auto">
        <div className="border-b border-[#E2E8F0] p-4">
          <h2 className="text-sm font-semibold text-[#0F172A]">Lead Source Conversion</h2>
          <p className="text-xs text-[#64748B]">Shared reporting dataset for source quality, funded volume, and conversion rate</p>
        </div>
        <table className="w-full min-w-[840px] text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr>{['Source', 'Leads', 'Deals', 'Funded', 'Funded Volume', 'Conversion'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{trustedReports.sourceRows.map((row) => <tr key={row.source}><td className="px-4 py-3 font-semibold capitalize">{row.source.replaceAll('_', ' ')}</td><td className="px-4 py-3">{row.leads}</td><td className="px-4 py-3">{row.deals}</td><td className="px-4 py-3">{row.funded}</td><td className="px-4 py-3">{currency(row.funded_volume)}</td><td className="px-4 py-3">{pct(row.conversion_rate)}</td></tr>)}</tbody></table>
      </CrmCard>
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
    ['Import/export tools', 'Prepare CSV exports and future import mapping.', Database, '/crm/reports'],
    ['Users & Access', 'Invite, revoke, audit, and manage CRM access.', Users, '/crm/users'],
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
  const { users: allUsers, deals, commissions, partners, isoBrokers, accessInvites, profile, loading, reload } = useCrmDataset();
  // Funders are companies we send packages to, not CRM users. Portal clients are
  // managed from their deals. Neither belongs in Users & Access.
  const users = allUsers.filter((user: RecordMap) => !['funder', 'client'].includes(user.role));
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
      company_name: user.company_name || '',
      access_entity_type: user.access_entity_type || accessEntityTypeForUserRole(user.role || 'sales_rep'),
      access_entity_id: user.access_entity_id || '',
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      is_active: user.is_active !== false,
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
      company_name: form.company_name,
      access_entity_type: form.access_entity_type || accessEntityTypeForUserRole(form.role),
      access_entity_id: form.access_entity_id,
      permissions: Array.isArray(form.permissions) ? form.permissions : [],
      is_active: form.is_active,
    };
    const response = await fetch(editingUser ? `/api/crm/users/${editingUser.id}` : '/api/crm/users', {
      method: editingUser ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to save user');
    else {
      toast.success(editingUser ? 'User updated' : 'Invite sent');
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
      toast.success(user.is_active ? 'Access revoked' : 'User activated');
      reload();
    }
  };

  const resendInvite = async (user: RecordMap) => {
    if (!canCreateUsers) {
      toast.error('Only admins can resend invites.');
      return;
    }
    const response = await fetch(`/api/crm/users/${user.id}/invite`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to resend invite');
    else {
      toast.success(result.emailSent ? 'Invite resent' : 'Invite created but email failed');
      reload();
    }
  };
  const roles = profile?.role === 'super_admin'
    ? ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'iso_broker', 'broker', 'referral_partner', 'viewer']
    : ['admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'iso_broker', 'broker', 'referral_partner', 'viewer'];
  const togglePermission = (permission: string, checked: boolean) => {
    const current = Array.isArray(form.permissions) ? form.permissions : [];
    setForm({ ...form, permissions: checked ? Array.from(new Set([...current, permission])) : current.filter((item: string) => item !== permission) });
  };
  const copyReferralUrl = async (user: RecordMap) => {
    const url = repReferralUrl(user.referral_token || user.referral_slug);
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
    ['iso_broker', 'External ISO. Can submit and track their own submissions.'],
    ['broker', 'External broker. Can submit and track their own submissions.'],
    ['referral_partner', 'External referral partner. Can submit referrals and view allowed status.'],
    ['viewer', 'Read-only internal CRM visibility.'],
  ];
  const inviteByProfile = new Map(accessInvites.filter((invite: RecordMap) => invite.user_profile_id).map((invite: RecordMap) => [invite.user_profile_id, invite]));
  return (
    <PageFrame title="Users & Access" subtitle="Invite CRM users, assign roles, revoke access, and audit invite status. Funders are managed under Funders and never get CRM access." actions={canCreateUsers ? <Button data-testid="create-user" className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={openCreateUser}><Plus className="mr-2 h-4 w-4" />Send Invite</Button> : null}>
      <CrmCard className="overflow-x-auto">
        <table className="w-full min-w-[1320px] text-left text-sm"><thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr>{['User', 'Role', 'Organization', 'Access', 'Invite', 'Deals', 'Funded volume', 'Earnings', 'Last login', 'Actions'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#E2E8F0]">{users.map((user: RecordMap) => { const userDeals = deals.filter((deal: RecordMap) => deal.assigned_user_id === user.id); const userEarnings = commissions.filter((row: RecordMap) => row.rep_id === user.id).reduce((sum: number, row: RecordMap) => sum + Number(row.commission_amount || 0), 0); const canDeleteUser = canCreateUsers && user.id !== profile?.id && !(user.role === 'super_admin' && profile?.role !== 'super_admin'); const referralValue = user.referral_token || user.referral_slug; const invite = inviteByProfile.get(user.id) || {}; const accessName = user.access_entity_type === 'funding_partner' ? partners.find((partner: RecordMap) => partner.id === user.access_entity_id)?.name : user.access_entity_type === 'iso_broker' ? isoBrokers.find((broker: RecordMap) => broker.id === user.access_entity_id)?.company_name : user.company_name; return <tr key={user.id}><td className="px-4 py-3"><p className="font-semibold">{userDisplayName(user)}</p><p className="text-xs text-[#64748B]">{user.email || 'No email saved'}</p></td><td className="px-4 py-3 capitalize">{user.role?.replaceAll('_', ' ')}</td><td className="px-4 py-3"><p className="font-medium text-[#0F172A]">{accessName || 'Elite Funding Solutions'}</p><p className="text-xs capitalize text-[#64748B]">{(user.access_entity_type || 'internal').replaceAll('_', ' ')}</p>{referralValue && ['sales_rep','admin','manager','processor','underwriter'].includes(user.role) ? <code className="mt-1 block max-w-[320px] truncate rounded bg-[#F1F5F9] px-2 py-1 text-[11px] text-[#334155]" title={repReferralDisplayUrl(referralValue)}>{repReferralDisplayUrl(referralValue)}</code> : null}</td><td className="px-4 py-3"><StatusBadge value={user.is_active ? 'active' : 'revoked'} /></td><td className="px-4 py-3"><StatusBadge value={user.invite_status || invite.status || (user.last_login_at ? 'accepted' : 'not_invited')} /><p className="mt-1 text-xs text-[#64748B]">{user.invite_accepted_at ? `Accepted ${date(user.invite_accepted_at)}` : user.invited_at ? `Sent ${date(user.invited_at)}` : 'No invite recorded'}</p></td><td className="px-4 py-3">{userDeals.length}</td><td className="px-4 py-3">{currency(userDeals.reduce((sum: number, deal: RecordMap) => sum + Number(deal.funded_amount || 0), 0))}</td><td className="px-4 py-3">{currency(userEarnings)}</td><td className="px-4 py-3">{user.last_login_at ? date(user.last_login_at) : 'Never signed in'}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{canCreateUsers ? <><Button data-testid={`edit-user-${user.id}`} variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => openEditUser(user)}>Edit</Button><Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => resendInvite(user)}>Resend Invite</Button><Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => toggleUserActive(user)}>{user.is_active ? 'Revoke' : 'Activate'}</Button>{['sales_rep','admin','manager','processor','underwriter'].includes(user.role) ? <Button variant="outline" size="sm" className="h-8 rounded-[7px]" onClick={() => copyReferralUrl(user)}>Copy Referral</Button> : null}{canDeleteUser ? <DeleteConfirmButton itemLabel={`user ${userDisplayName(user)}`} endpoint={`/api/crm/users/${user.id}`} onDeleted={reload} buttonClassName="h-8 rounded-[7px]" /> : null}</> : <span className="text-xs text-[#64748B]">Read only</span>}</div></td></tr>; })}</tbody></table>
      </CrmCard>
      <CrmCard className="mt-4 p-4">
        <h2 className="text-sm font-semibold text-[#0F172A]">Permission Matrix</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {permissions.map(([role, description]) => <div key={role} className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3"><p className="text-xs font-semibold uppercase text-[#0F2B5B]">{role.replaceAll('_', ' ')}</p><p className="mt-1 text-xs leading-5 text-[#64748B]">{description}</p></div>)}
        </div>
      </CrmCard>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[8px]">
          <DialogHeader><DialogTitle>{editingUser ? 'Edit access' : 'Send invite'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['First name', 'first_name'],
              ['Last name', 'last_name'],
              ['Email', 'email'],
            ].map(([label, key]) => (
              <div key={key}>
                <Label className="text-xs text-[#64748B]">{label}</Label>
                <Input data-testid={`user-${key}`} value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 rounded-[7px]" />
              </div>
            ))}
            <div>
              <Label className="text-xs text-[#64748B]">Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value, access_entity_type: accessEntityTypeForUserRole(value), access_entity_id: '' })}>
                <SelectTrigger data-testid="user-role" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map((role) => <SelectItem key={role} value={role}>{role.replaceAll('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-[#64748B]">Company / Organization</Label>
              <Input data-testid="user-company-name" value={form.company_name || ''} onChange={(event) => setForm({ ...form, company_name: event.target.value })} placeholder={form.access_entity_type === 'funding_partner' ? 'ABC Funding' : form.access_entity_type === 'iso_broker' ? 'Elite Capital Brokers' : 'Elite Funding Solutions'} className="mt-1 rounded-[7px]" />
            </div>
            {form.access_entity_type === 'iso_broker' && (
              <div>
                <Label className="text-xs text-[#64748B]">ISO / broker organization</Label>
                <Select value={form.access_entity_id || 'new'} onValueChange={(value) => setForm({ ...form, access_entity_id: value === 'new' ? '' : value })}>
                  <SelectTrigger data-testid="user-access-entity" className="mt-1 rounded-[7px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Create from company name</SelectItem>
                    {isoBrokers.map((broker: RecordMap) => <SelectItem key={broker.id} value={broker.id}>{broker.company_name || broker.broker_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
          <DialogFooter><Button data-testid="save-user" onClick={saveUser} className="rounded-[7px] bg-[#0F2B5B]">{editingUser ? 'Save access' : 'Send Invite'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
