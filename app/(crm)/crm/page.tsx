'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import Link from 'next/link';
import { TrendingUp, FileText, CircleAlert as AlertCircle, ClipboardCheck, Tag, Signature as FileSignature, DollarSign, RefreshCw, ArrowRight, ArrowUp, Minus } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────
interface DashboardMetrics {
  new_applications: number;
  documents_pending: number;
  underwriting_queue: number;
  offers_received: number;
  contracts_pending: number;
  funded_volume_mtd: number;
  renewal_opportunities: number;
  active_deals: number;
}

interface DealRow {
  id: string;
  stage_slug: string;
  requested_amount: number | null;
  business_name: string | null;
  assigned_rep_name: string | null;
  updated_at: string;
  funding_probability: number;
  missing_documents: number | null;
}

// ─── KPI Card ────────────────────────────────────────────────────────────
function KpiCard({
  title, value, subtitle, icon, trend, href, color = '#2563EB'
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: number;
  href?: string;
  color?: string;
}) {
  const content = (
    <div
      className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:border-[#D4D4D8] transition-all duration-200 group"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[12px] font-semibold ${trend > 0 ? 'text-[#10B981]' : trend < 0 ? 'text-[#EF4444]' : 'text-[#A1A1AA]'}`}>
            {trend > 0 ? <ArrowUp className="w-3 h-3" /> : trend < 0 ? <ArrowUp className="w-3 h-3 rotate-180" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-[28px] font-bold text-[#09090B] tracking-tight leading-none mb-1">
        {value}
      </div>
      <div className="text-[13px] font-medium text-[#71717A]">{title}</div>
      <div className="text-[12px] text-[#A1A1AA] mt-0.5">{subtitle}</div>
      {href && (
        <div className="mt-3 flex items-center gap-1 text-[12px] font-medium text-[#2563EB] opacity-0 group-hover:opacity-100 transition-opacity">
          View all <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

// ─── Pipeline funnel data ─────────────────────────────────────────────────
const funnelData = [
  { stage: 'Applied', count: 48 },
  { stage: 'Docs', count: 36 },
  { stage: 'UW Review', count: 22 },
  { stage: 'Offers', count: 15 },
  { stage: 'Contracted', count: 11 },
  { stage: 'Funded', count: 9 },
];

const volumeData = [
  { month: 'Jul', funded: 280000 },
  { month: 'Aug', funded: 340000 },
  { month: 'Sep', funded: 290000 },
  { month: 'Oct', funded: 420000 },
  { month: 'Nov', funded: 380000 },
  { month: 'Dec', funded: 510000 },
  { month: 'Jan', funded: 460000 },
  { month: 'Feb', funded: 590000 },
  { month: 'Mar', funded: 620000 },
  { month: 'Apr', funded: 540000 },
  { month: 'May', funded: 710000 },
];

const stageColors: Record<string, string> = {
  lead_captured: '#A1A1AA',
  application_started: '#F59E0B',
  application_submitted: '#2563EB',
  documents_requested: '#F59E0B',
  documents_received: '#2563EB',
  underwriting_review: '#8B5CF6',
  submitted_to_partners: '#2563EB',
  offers_received: '#10B981',
  offer_presented: '#10B981',
  contract_sent: '#F59E0B',
  contract_signed: '#10B981',
  funded: '#10B981',
  renewal_eligible: '#2563EB',
  declined: '#EF4444',
  lost_unresponsive: '#A1A1AA',
};

function stageBadge(slug: string) {
  const labels: Record<string, string> = {
    lead_captured: 'Lead',
    application_started: 'App Started',
    application_submitted: 'Submitted',
    documents_requested: 'Docs Needed',
    documents_received: 'Docs In',
    underwriting_review: 'Underwriting',
    submitted_to_partners: 'Submitted',
    offers_received: 'Offers In',
    offer_presented: 'Offer Sent',
    contract_sent: 'Contract Out',
    contract_signed: 'Signed',
    funded: 'Funded',
    renewal_eligible: 'Renewal',
    declined: 'Declined',
    lost_unresponsive: 'Lost',
  };
  const color = stageColors[slug] ?? '#A1A1AA';
  return (
    <span
      className="inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {labels[slug] ?? slug}
    </span>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────
export default function CrmDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentDeals, setRecentDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [metricsRes, dealsRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc('get_dashboard_metrics', { p_org_id: DEFAULT_ORG_ID }),
        supabase
          .from('deal_summary_view')
          .select('id,stage_slug,requested_amount,business_name,assigned_rep_name,updated_at,funding_probability,missing_documents')
          .eq('organization_id', DEFAULT_ORG_ID)
          .order('updated_at', { ascending: false })
          .limit(8),
      ]);

      if (metricsRes.data) setMetrics(metricsRes.data as DashboardMetrics);
      if (dealsRes.data) setRecentDeals(dealsRes.data as DealRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const m = metrics ?? {
    new_applications: 0, documents_pending: 0, underwriting_queue: 0,
    offers_received: 0, contracts_pending: 0, funded_volume_mtd: 0,
    renewal_opportunities: 0, active_deals: 0,
  };

  const fmt = (n: number) =>
    n >= 1000000
      ? `$${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `$${(n / 1000).toFixed(0)}K`
      : `$${n.toLocaleString()}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Dashboard"
        subtitle="Welcome back. Here's what needs your attention."
        actions={
          <Link
            href="/crm/applications"
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#2563EB] text-white font-semibold text-[13px] h-9 px-4 hover:bg-[#1D4ED8] transition-colors"
          >
            New Application
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-8">
        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard
            title="New Applications"
            value={loading ? '—' : m.new_applications}
            subtitle="Last 30 days"
            icon={<FileText className="w-5 h-5" />}
            trend={12}
            href="/crm/applications"
            color="#2563EB"
          />
          <KpiCard
            title="Documents Pending"
            value={loading ? '—' : m.documents_pending}
            subtitle="Awaiting upload"
            icon={<AlertCircle className="w-5 h-5" />}
            href="/crm/documents"
            color="#F59E0B"
          />
          <KpiCard
            title="Underwriting Queue"
            value={loading ? '—' : m.underwriting_queue}
            subtitle="Files in review"
            icon={<ClipboardCheck className="w-5 h-5" />}
            href="/crm/underwriting"
            color="#8B5CF6"
          />
          <KpiCard
            title="Offers Received"
            value={loading ? '—' : m.offers_received}
            subtitle="Awaiting presentation"
            icon={<Tag className="w-5 h-5" />}
            href="/crm/offers"
            color="#10B981"
          />
          <KpiCard
            title="Contracts Pending"
            value={loading ? '—' : m.contracts_pending}
            subtitle="Sent, awaiting signature"
            icon={<FileSignature className="w-5 h-5" />}
            href="/crm/contracts"
            color="#2563EB"
          />
          <KpiCard
            title="Funded MTD"
            value={loading ? '—' : fmt(m.funded_volume_mtd)}
            subtitle="Month-to-date volume"
            icon={<DollarSign className="w-5 h-5" />}
            trend={8}
            href="/crm/reports"
            color="#10B981"
          />
          <KpiCard
            title="Renewal Opportunities"
            value={loading ? '—' : m.renewal_opportunities}
            subtitle="Eligible for renewal"
            icon={<RefreshCw className="w-5 h-5" />}
            href="/crm/renewals"
            color="#F59E0B"
          />
          <KpiCard
            title="Active Deals"
            value={loading ? '—' : m.active_deals}
            subtitle="In pipeline"
            icon={<TrendingUp className="w-5 h-5" />}
            href="/crm/pipeline"
            color="#2563EB"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Funded volume chart */}
          <div
            className="lg:col-span-2 bg-white border border-[#E4E4E7] rounded-[16px] p-6"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[15px] font-semibold text-[#09090B]">Funded Volume</h3>
                <p className="text-[13px] text-[#A1A1AA]">Last 11 months</p>
              </div>
              <span className="badge-success">+18% YoY</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={volumeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fundGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#A1A1AA' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#A1A1AA' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}K`} />
                <Tooltip
                  contentStyle={{ border: '1px solid #E4E4E7', borderRadius: 10, fontSize: 13 }}
                  formatter={(v: number) => [`$${v.toLocaleString()}`, 'Funded']}
                />
                <Area type="monotone" dataKey="funded" stroke="#2563EB" strokeWidth={2} fill="url(#fundGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pipeline funnel */}
          <div
            className="bg-white border border-[#E4E4E7] rounded-[16px] p-6"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
          >
            <div className="mb-6">
              <h3 className="text-[15px] font-semibold text-[#09090B]">Pipeline Funnel</h3>
              <p className="text-[13px] text-[#A1A1AA]">Current stage distribution</p>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#A1A1AA' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 12, fill: '#71717A' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={{ border: '1px solid #E4E4E7', borderRadius: 10, fontSize: 13 }} />
                <Bar dataKey="count" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent deals table */}
        <div
          className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F4F4F5]">
            <h3 className="text-[15px] font-semibold text-[#09090B]">Recent Pipeline Activity</h3>
            <Link
              href="/crm/pipeline"
              className="text-[13px] font-medium text-[#2563EB] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F4F4F5]">
                  {['Business', 'Stage', 'Amount', 'Probability', 'Assigned Rep', 'Docs Missing', 'Last Update'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[14px] text-[#A1A1AA]">Loading…</td>
                  </tr>
                ) : recentDeals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[14px] text-[#A1A1AA]">No deals yet</td>
                  </tr>
                ) : (
                  recentDeals.map((deal) => (
                    <tr key={deal.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-4 py-3.5">
                        <Link href={`/crm/deals/${deal.id}`} className="text-[14px] font-medium text-[#09090B] hover:text-[#2563EB] transition-colors">
                          {deal.business_name ?? '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">{stageBadge(deal.stage_slug)}</td>
                      <td className="px-4 py-3.5 text-[14px] text-[#09090B]">
                        {deal.requested_amount ? `$${(deal.requested_amount / 1000).toFixed(0)}K` : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#F4F4F5] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#2563EB]"
                              style={{ width: `${deal.funding_probability}%` }}
                            />
                          </div>
                          <span className="text-[13px] text-[#71717A]">{deal.funding_probability}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-[#71717A]">
                        {deal.assigned_rep_name ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        {(deal.missing_documents ?? 0) > 0 ? (
                          <span className="badge-warning">{deal.missing_documents} missing</span>
                        ) : (
                          <span className="badge-success">Complete</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-[#A1A1AA] whitespace-nowrap">
                        {new Date(deal.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
