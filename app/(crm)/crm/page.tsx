'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import Link from 'next/link';
import { TrendingUp, FileText, AlertCircle, ClipboardCheck, DollarSign, RefreshCw, ArrowRight, ArrowUp, Minus } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardMetrics {
  new_applications: number;
  documents_pending: number;
  underwriting_queue: number;
  active_deals: number;
  funded_volume_mtd: number;
  renewal_opportunities: number;
  total_leads: number;
  avg_deal_size: number;
}

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

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    new_applications: 0,
    documents_pending: 0,
    underwriting_queue: 0,
    active_deals: 0,
    funded_volume_mtd: 0,
    renewal_opportunities: 0,
    total_leads: 0,
    avg_deal_size: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dealsByStage, setDealsByStage] = useState<any[]>([]);
  const [recentDeals, setRecentDeals] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load all metrics in parallel
      const [
        { data: applications },
        { data: deals },
        { data: renewals },
        { data: leads },
        { data: documents },
      ] = await Promise.all([
        supabase.from('applications').select('*').eq('organization_id', DEFAULT_ORG_ID),
        supabase.from('deals').select('*').eq('organization_id', DEFAULT_ORG_ID).is('deleted_at', null),
        supabase.from('renewals').select('*').eq('organization_id', DEFAULT_ORG_ID),
        supabase.from('leads').select('*').eq('organization_id', DEFAULT_ORG_ID).is('deleted_at', null),
        supabase.from('documents').select('*').eq('organization_id', DEFAULT_ORG_ID),
      ]);

      // Calculate metrics
      const newApps = applications?.filter(a => ['submitted', 'in_review'].includes(a.status)).length || 0;
      const docsPending = applications?.filter(a => a.status === 'docs_requested').length || 0;
      const uwQueue = applications?.filter(a => ['in_review', 'under_review'].includes(a.status)).length || 0;
      const activeDeals = deals?.length || 0;
      const fundedDeals = deals?.filter(d => d.stage === 'funded') || [];
      const fundedVolume = fundedDeals.reduce((sum, d) => sum + (d.requested_amount || 0), 0);
      const renewalOpps = renewals?.filter(r => r.status === 'eligible').length || 0;
      const totalLeads = leads?.length || 0;
      const avgDeal = deals && deals.length > 0 
        ? Math.round(deals.reduce((sum, d) => sum + (d.requested_amount || 0), 0) / deals.length)
        : 0;

      setMetrics({
        new_applications: newApps,
        documents_pending: docsPending,
        underwriting_queue: uwQueue,
        active_deals: activeDeals,
        funded_volume_mtd: fundedVolume,
        renewal_opportunities: renewalOpps,
        total_leads: totalLeads,
        avg_deal_size: avgDeal,
      });

      // Deals by stage for chart
      const stages = ['lead', 'application', 'documents', 'underwriting', 'offer', 'contract', 'funded'];
      const stageData = stages.map(stage => ({
        stage: stage.charAt(0).toUpperCase() + stage.slice(1),
        count: deals?.filter(d => d.stage === stage).length || 0,
      }));
      setDealsByStage(stageData);

      // Recent deals
      const recent = deals?.slice(0, 5).map(d => ({
        id: d.id,
        business_name: d.business_name,
        amount: d.requested_amount,
        stage: d.stage,
        created_at: d.created_at,
      })) || [];
      setRecentDeals(recent);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <CrmTopbar title="Dashboard" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#A1A1AA]">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Dashboard"
        subtitle={`Welcome back! Here's your business overview`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            title="New Applications"
            value={metrics.new_applications}
            subtitle="Pending review"
            icon={<FileText className="w-5 h-5" />}
            href="/crm/applications"
            color="#2563EB"
          />
          <KpiCard
            title="Active Deals"
            value={metrics.active_deals}
            subtitle="In pipeline"
            icon={<TrendingUp className="w-5 h-5" />}
            href="/crm/pipeline"
            color="#7C3AED"
          />
          <KpiCard
            title="Funded MTD"
            value={`$${(metrics.funded_volume_mtd / 1000).toFixed(0)}k`}
            subtitle="This month"
            icon={<DollarSign className="w-5 h-5" />}
            color="#059669"
          />
          <KpiCard
            title="Renewals"
            value={metrics.renewal_opportunities}
            subtitle="Eligible clients"
            icon={<RefreshCw className="w-5 h-5" />}
            href="/crm/renewals"
            color="#D97706"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <KpiCard
            title="Underwriting Queue"
            value={metrics.underwriting_queue}
            subtitle="Need review"
            icon={<ClipboardCheck className="w-5 h-5" />}
            href="/crm/underwriting"
            color="#0891B2"
          />
          <KpiCard
            title="Documents Pending"
            value={metrics.documents_pending}
            subtitle="Awaiting upload"
            icon={<AlertCircle className="w-5 h-5" />}
            color="#EF4444"
          />
          <KpiCard
            title="Total Leads"
            value={metrics.total_leads}
            subtitle="All time"
            icon={<TrendingUp className="w-5 h-5" />}
            href="/crm/leads"
            color="#8B5CF6"
          />
          <KpiCard
            title="Avg Deal Size"
            value={`$${(metrics.avg_deal_size / 1000).toFixed(0)}k`}
            subtitle="Average funding"
            icon={<DollarSign className="w-5 h-5" />}
            color="#10B981"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Pipeline Funnel Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dealsByStage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="stage" stroke="#71717A" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#71717A" style={{ fontSize: '12px' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563EB" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Deals */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Deals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentDeals.length === 0 ? (
                  <div className="text-center py-8 text-[#A1A1AA]">No recent deals</div>
                ) : (
                  recentDeals.map((deal) => (
                    <div key={deal.id} className="flex items-center justify-between py-2 border-b border-[#F4F4F5] last:border-0">
                      <div>
                        <div className="font-medium text-[#09090B]">{deal.business_name}</div>
                        <div className="text-xs text-[#71717A] capitalize">{deal.stage}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[#09090B]">${deal.amount?.toLocaleString() || '0'}</div>
                        <div className="text-xs text-[#A1A1AA]">
                          {new Date(deal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
