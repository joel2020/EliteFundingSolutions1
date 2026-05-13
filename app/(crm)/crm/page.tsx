'use client';

import { useEffect, useMemo, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import Link from 'next/link';
import { TrendingUp, FileText, AlertCircle, ClipboardCheck, DollarSign, RefreshCw, ArrowRight, FileCheck2, Send, Signature, CheckCircle2, Clock, CalendarCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MCA_STAGE_LABELS: Record<string, string> = {
  lead_captured: 'Lead Captured',
  application_started: 'Application Started',
  application_submitted: 'Application Submitted',
  documents_requested: 'Documents Requested',
  documents_received: 'Documents Received',
  underwriting_review: 'Underwriting Review',
  submitted_to_partners: 'Submitted to Partners',
  offers_received: 'Offers Received',
  offer_presented: 'Offer Presented',
  contract_sent: 'Contract Sent',
  contract_signed: 'Contract Signed',
  funded: 'Funded',
  renewal_eligible: 'Renewal Eligible',
  declined: 'Declined',
  lost_unresponsive: 'Lost / Unresponsive',
};

const PIPELINE_ORDER = Object.keys(MCA_STAGE_LABELS);

interface DashboardMetrics {
  new_applications: number;
  documents_received: number;
  documents_pending: number;
  underwriting_queue: number;
  offers_out: number;
  contracts_sent: number;
  funded_volume_mtd: number;
  renewal_opportunities: number;
  tasks_due_today: number;
  follow_ups_overdue: number;
}

function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function KpiCard({ title, value, subtitle, icon, href, color = '#2563EB' }: { title: string; value: string | number; subtitle: string; icon: React.ReactNode; href?: string; color?: string }) {
  const content = (
    <div className="bg-white border border-[#E4E4E7] rounded-[18px] p-5 hover:border-[#C9A84C]/50 hover:shadow-[0_14px_40px_rgba(6,13,27,0.08)] transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}16`, color }}>{icon}</div>
        {href && <ArrowRight className="w-4 h-4 text-[#C9A84C] opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <div className="text-[28px] font-bold text-[#09090B] tracking-tight leading-none mb-1">{value}</div>
      <div className="text-[13px] font-semibold text-[#0A1628]">{title}</div>
      <div className="text-[12px] text-[#71717A] mt-0.5">{subtitle}</div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-[18px]" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Skeleton className="h-96 rounded-[18px]" /><Skeleton className="h-96 rounded-[18px]" /></div>
    </div>
  );
}

export default function DashboardPage() {
  const { organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    new_applications: 0,
    documents_received: 0,
    documents_pending: 0,
    underwriting_queue: 0,
    offers_out: 0,
    contracts_sent: 0,
    funded_volume_mtd: 0,
    renewal_opportunities: 0,
    tasks_due_today: 0,
    follow_ups_overdue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dealsByStage, setDealsByStage] = useState<any[]>([]);
  const [recentDeals, setRecentDeals] = useState<any[]>([]);
  const [recentApplications, setRecentApplications] = useState<any[]>([]);

  const todayRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    return { start: start.toISOString(), end: end.toISOString(), monthStart: monthStart.toISOString() };
  }, []);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setError(crmUserError || 'CRM profile unavailable.'); setLoading(false); return; }
    loadDashboardData();
  }, [crmUserLoading, organizationId, crmUserError]);

  const loadDashboardData = async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);

    const [applicationsResult, dealsResult, renewalsResult, documentsResult, tasksResult, leadsResult] = await Promise.all([
      supabase.from('applications').select('id,status,requested_amount,created_at,submitted_at,business_id,businesses(legal_name,dba)').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
      supabase.from('deals').select('id,stage_slug,requested_amount,funded_amount,funded_at,created_at,businesses(legal_name,dba)').eq('organization_id', organizationId).is('deleted_at', null).order('created_at', { ascending: false }).limit(250),
      supabase.from('renewals').select('id,status').eq('organization_id', organizationId).eq('status', 'eligible').limit(1000),
      supabase.from('documents').select('id,status,document_type,application_id,deal_id,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(1000),
      supabase.from('tasks').select('id,status,due_date').eq('organization_id', organizationId).in('status', ['open', 'in_progress']).limit(1000),
      supabase.from('leads').select('id,next_follow_up_at,status').eq('organization_id', organizationId).is('deleted_at', null).limit(1000),
    ]);

    const firstError = [applicationsResult.error, dealsResult.error, renewalsResult.error, documentsResult.error, tasksResult.error, leadsResult.error].find(Boolean);
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const applications = applicationsResult.data || [];
    const deals = dealsResult.data || [];
    const renewals = renewalsResult.data || [];
    const documents = documentsResult.data || [];
    const tasks = tasksResult.data || [];
    const leads = leadsResult.data || [];

    const newApps = applications.filter((a: any) => ['submitted', 'under_review'].includes(a.status)).length;
    const docsReceived = deals.filter((d: any) => d.stage_slug === 'documents_received').length + documents.filter((d: any) => d.status === 'uploaded').length;
    const docsPending = deals.filter((d: any) => d.stage_slug === 'documents_requested').length;
    const underwritingQueue = deals.filter((d: any) => ['underwriting_review', 'submitted_to_partners'].includes(d.stage_slug)).length + applications.filter((a: any) => a.status === 'under_review').length;
    const offersOut = deals.filter((d: any) => ['offers_received', 'offer_presented'].includes(d.stage_slug)).length;
    const contractsSent = deals.filter((d: any) => d.stage_slug === 'contract_sent').length;
    const fundedVolume = deals.filter((d: any) => d.stage_slug === 'funded' && d.funded_at && d.funded_at >= todayRange.monthStart).reduce((sum: number, d: any) => sum + Number(d.funded_amount || d.requested_amount || 0), 0);
    const tasksDueToday = tasks.filter((t: any) => t.due_date && t.due_date >= todayRange.start && t.due_date < todayRange.end).length;
    const followUpsOverdue = leads.filter((l: any) => l.next_follow_up_at && l.next_follow_up_at < todayRange.start && !['converted', 'lost', 'unresponsive'].includes(l.status)).length;

    setMetrics({ new_applications: newApps, documents_received: docsReceived, documents_pending: docsPending, underwriting_queue: underwritingQueue, offers_out: offersOut, contracts_sent: contractsSent, funded_volume_mtd: fundedVolume, renewal_opportunities: renewals.length, tasks_due_today: tasksDueToday, follow_ups_overdue: followUpsOverdue });
    setDealsByStage(PIPELINE_ORDER.map((slug) => ({ stage: MCA_STAGE_LABELS[slug], count: deals.filter((d: any) => d.stage_slug === slug).length })));
    setRecentDeals(deals.slice(0, 6).map((d: any) => ({ id: d.id, business_name: d.businesses?.legal_name || d.businesses?.dba || 'Unnamed business', amount: d.funded_amount || d.requested_amount || 0, stage: MCA_STAGE_LABELS[d.stage_slug] || d.stage_slug, created_at: d.created_at })));
    setRecentApplications(applications.slice(0, 6).map((a: any) => ({ id: a.id, business_name: a.businesses?.legal_name || a.businesses?.dba || 'Unlinked application', amount: a.requested_amount || 0, status: a.status, created_at: a.submitted_at || a.created_at })));
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar title="Dashboard" subtitle="MCA funding operations command center" />
      <div className="flex-1 overflow-y-auto bg-[#F6F7FA]">
        {loading ? <DashboardSkeleton /> : (
          <div className="p-4 md:p-6 space-y-6">
            {(error || crmUserError) && <Alert className="border-red-200 bg-red-50"><AlertDescription className="text-red-700">{error || crmUserError}</AlertDescription></Alert>}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard title="New Applications" value={metrics.new_applications} subtitle="Submitted / under review" icon={<FileText className="w-5 h-5" />} href="/crm/applications" color="#2563EB" />
              <KpiCard title="Documents Received" value={metrics.documents_received} subtitle="Uploaded and awaiting review" icon={<FileCheck2 className="w-5 h-5" />} href="/crm/documents" color="#059669" />
              <KpiCard title="Documents Pending" value={metrics.documents_pending} subtitle="Requested from merchants" icon={<AlertCircle className="w-5 h-5" />} href="/crm/documents" color="#EF4444" />
              <KpiCard title="Underwriting Queue" value={metrics.underwriting_queue} subtitle="Ready for review / partner submission" icon={<ClipboardCheck className="w-5 h-5" />} href="/crm/underwriting" color="#7C3AED" />
              <KpiCard title="Offers Out" value={metrics.offers_out} subtitle="Received or presented" icon={<Send className="w-5 h-5" />} href="/crm/offers" color="#0891B2" />
              <KpiCard title="Contracts Sent" value={metrics.contracts_sent} subtitle="Awaiting signature" icon={<Signature className="w-5 h-5" />} href="/crm/contracts" color="#D97706" />
              <KpiCard title="Funded MTD" value={currency(metrics.funded_volume_mtd)} subtitle="Funded amount this month" icon={<DollarSign className="w-5 h-5" />} color="#059669" />
              <KpiCard title="Renewal Opportunities" value={metrics.renewal_opportunities} subtitle="Eligible renewal clients" icon={<RefreshCw className="w-5 h-5" />} href="/crm/renewals" color="#C9A84C" />
              <KpiCard title="Tasks Due Today" value={metrics.tasks_due_today} subtitle="Open CRM tasks" icon={<CalendarCheck className="w-5 h-5" />} href="/crm/tasks" color="#0A1628" />
              <KpiCard title="Follow-ups Overdue" value={metrics.follow_ups_overdue} subtitle="Lead follow-ups past due" icon={<Clock className="w-5 h-5" />} href="/crm/leads" color="#DC2626" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="border-[#E4E4E7] rounded-[18px]"><CardHeader><CardTitle className="text-[#0A1628]">Pipeline by MCA Stage</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={320}><BarChart data={dealsByStage}><CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" /><XAxis dataKey="stage" stroke="#71717A" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={90} /><YAxis stroke="#71717A" tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="count" fill="#C9A84C" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></CardContent></Card>
              <Card className="border-[#E4E4E7] rounded-[18px]"><CardHeader><CardTitle className="text-[#0A1628]">Recent Deals</CardTitle></CardHeader><CardContent><div className="space-y-3">{recentDeals.length === 0 ? <div className="text-center py-10 text-[#71717A]">No recent deals yet.</div> : recentDeals.map((deal) => <div key={deal.id} className="flex items-center justify-between gap-4 rounded-[12px] border border-[#F1F3F7] p-3"><div><div className="font-semibold text-[#09090B]">{deal.business_name}</div><div className="text-xs text-[#71717A]">{deal.stage}</div></div><div className="text-right"><div className="font-bold text-[#09090B]">{currency(deal.amount)}</div><div className="text-xs text-[#A1A1AA]">{new Date(deal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div></div>)}</div></CardContent></Card>
            </div>

            <Card className="border-[#E4E4E7] rounded-[18px]"><CardHeader><CardTitle className="text-[#0A1628]">Recent Applications</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{recentApplications.length === 0 ? <div className="text-center py-10 text-[#71717A] lg:col-span-2">No applications submitted yet.</div> : recentApplications.map((app) => <div key={app.id} className="flex items-center justify-between gap-4 rounded-[12px] border border-[#F1F3F7] p-3"><div><div className="font-semibold text-[#09090B]">{app.business_name}</div><div className="text-xs text-[#71717A] capitalize">{app.status?.replaceAll('_', ' ')}</div></div><div className="text-right"><div className="font-bold text-[#09090B]">{currency(app.amount)}</div><Link className="text-xs font-semibold text-[#2563EB]" href="/crm/applications">Review</Link></div></div>)}</div></CardContent></Card>
          </div>
        )}
      </div>
    </div>
  );
}
