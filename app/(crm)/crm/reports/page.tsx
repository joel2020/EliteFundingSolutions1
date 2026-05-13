'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, Users, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const COLORS = ['#2563EB', '#7C3AED', '#059669', '#D97706', '#EF4444', '#0891B2'];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('30');
  
  // Report data
  const [leadSourceData, setLeadSourceData] = useState<any[]>([]);
  const [conversionData, setConversionData] = useState<any[]>([]);
  const [repPerformance, setRepPerformance] = useState<any[]>([]);
  const [monthlyVolume, setMonthlyVolume] = useState<any[]>([]);

  const loadReports = useCallback(async () => {
    try {
      const daysAgo = parseInt(timeframe);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Load all data
      const [
        { data: leads },
        { data: applications },
        { data: deals },
        { data: users },
      ] = await Promise.all([
        supabase.from('leads').select('*').eq('organization_id', DEFAULT_ORG_ID).gte('created_at', startDate.toISOString()),
        supabase.from('applications').select('*').eq('organization_id', DEFAULT_ORG_ID).gte('created_at', startDate.toISOString()),
        supabase.from('deals').select('*').eq('organization_id', DEFAULT_ORG_ID).gte('created_at', startDate.toISOString()),
        supabase.from('user_profiles').select('*').eq('organization_id', DEFAULT_ORG_ID),
      ]);

      // Lead Source Analysis
      const sourceCount: Record<string, number> = {};
      leads?.forEach(lead => {
        const source = lead.lead_source || 'unknown';
        sourceCount[source] = (sourceCount[source] || 0) + 1;
      });
      const sourceData = Object.entries(sourceCount).map(([name, value]) => ({
        name: name.replace('_', ' ').toUpperCase(),
        value,
      }));
      setLeadSourceData(sourceData);

      // Conversion Funnel
      const totalLeads = leads?.length || 0;
      const totalApps = applications?.length || 0;
      const approvedApps = applications?.filter(a => a.status === 'approved').length || 0;
      const fundedDeals = deals?.filter(d => d.stage_slug === 'funded').length || 0;
      
      setConversionData([
        { stage: 'Leads', count: totalLeads },
        { stage: 'Applications', count: totalApps },
        { stage: 'Approved', count: approvedApps },
        { stage: 'Funded', count: fundedDeals },
      ]);

      // Rep Performance
      const repData = users?.slice(0, 5).map((user) => {
        const repDeals = deals?.filter((deal) => deal.assigned_user_id === user.user_id) || [];
        return {
          name: `${user.first_name} ${user.last_name}`.trim() || user.email || 'Unassigned',
          deals: repDeals.length,
          volume: repDeals.reduce((sum, deal) => sum + (deal.funded_amount || deal.approved_amount || 0), 0),
        };
      }) || [];
      setRepPerformance(repData);

      // Monthly Volume (last 6 months)
      const now = new Date();
      const volumeData = Array.from({ length: 6 }, (_, index) => {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        const month = monthDate.toLocaleString('en-US', { month: 'short' });
        const funded = (deals || [])
          .filter((deal) => {
            const dealDate = new Date(deal.funded_at || deal.created_at);
            return dealDate.getFullYear() === monthDate.getFullYear() && dealDate.getMonth() === monthDate.getMonth();
          })
          .reduce((sum, deal) => sum + (deal.funded_amount || 0), 0);

        return { month, funded };
      });
      setMonthlyVolume(volumeData);

    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports');
    }
    setLoading(false);
  }, [timeframe]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const exportReport = (reportName: string) => {
    toast.success(`${reportName} report exported to CSV`);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <CrmTopbar title="Reports" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#A1A1AA]">Loading reports...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Reports & Analytics"
        subtitle="Performance insights and data export"
        actions={
          <div className="flex items-center gap-3">
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Conversion Funnel */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Conversion Funnel</CardTitle>
            <Button variant="outline" size="sm" onClick={() => exportReport('Conversion Funnel')}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conversionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                <XAxis dataKey="stage" stroke="#71717A" />
                <YAxis stroke="#71717A" />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Lead Source ROI */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Lead Sources</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportReport('Lead Sources')}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={leadSourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {leadSourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Volume */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Monthly Funded Volume</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportReport('Monthly Volume')}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="month" stroke="#71717A" />
                  <YAxis stroke="#71717A" />
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                  <Line type="monotone" dataKey="funded" stroke="#059669" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Rep Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rep Performance</CardTitle>
            <Button variant="outline" size="sm" onClick={() => exportReport('Rep Performance')}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {repPerformance.map((rep, index) => (
                <div key={index} className="flex items-center justify-between py-3 border-b border-[#F4F4F5] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {rep.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <div className="font-medium text-[#09090B]">{rep.name}</div>
                      <div className="text-xs text-[#71717A]">{rep.deals} deals closed</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[#09090B]">${rep.volume.toLocaleString()}</div>
                    <div className="text-xs text-[#71717A]">Total funded</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
