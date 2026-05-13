'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { DollarSign, TrendingUp, Users, Calendar } from 'lucide-react';
import type { Commission } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  paid: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function CommissionsPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadCommissions();
  }, [crmUserLoading, organizationId]);

  const loadCommissions = async () => {
    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load commissions');
      console.error(error);
    } else if (data) {
      setCommissions(data as Commission[]);
    }
    setLoading(false);
  };

  const updateStatus = async (commissionId: string, newStatus: string) => {
    const { error } = await supabase
      .from('commissions')
      .update({ status: newStatus })
      .eq('id', commissionId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      loadCommissions();
    }
  };

  const filtered = filterStatus === 'all' 
    ? commissions 
    : commissions.filter(c => c.status === filterStatus);

  const totalPending = commissions
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const totalApproved = commissions
    .filter(c => c.status === 'approved')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const totalPaid = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const totalCommissions = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Commissions"
        subtitle={`${commissions.length} commission records`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Total Commissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">
                ${totalCommissions.toLocaleString()}
              </div>
              <div className="text-xs text-[#71717A] mt-1">
                {commissions.length} deals
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                ${totalPending.toLocaleString()}
              </div>
              <div className="text-xs text-[#71717A] mt-1">
                {commissions.filter(c => c.status === 'pending').length} deals
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${totalApproved.toLocaleString()}
              </div>
              <div className="text-xs text-[#71717A] mt-1">
                {commissions.filter(c => c.status === 'approved').length} deals
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ${totalPaid.toLocaleString()}
              </div>
              <div className="text-xs text-[#71717A] mt-1">
                {commissions.filter(c => c.status === 'paid').length} deals
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm text-[#71717A]">Filter by status:</span>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Commissions</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Commissions Table */}
        <div className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F4F4F5]">
                {['Deal', 'Rep Name', 'Deal Amount', 'Commission', 'Split', 'Net', 'Status', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-[#A1A1AA]">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-[#A1A1AA]">No commissions found</td>
                </tr>
              ) : (
                filtered.map((commission) => (
                  <tr key={commission.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 font-medium text-[#09090B]">
                      {commission.deal_id || '—'}
                    </td>
                    <td className="px-4 py-3 text-[#52525B]">
                      {commission.rep_name || '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#09090B]">
                      ${commission.deal_amount?.toLocaleString() || '0'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600">
                      ${commission.amount?.toLocaleString() || '0'}
                    </td>
                    <td className="px-4 py-3 text-[#52525B]">
                      {commission.split_percentage ? `${commission.split_percentage}%` : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#09090B]">
                      ${commission.net_amount?.toLocaleString() || '0'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusColors[commission.status]}>
                        {commission.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#52525B] text-sm">
                      {new Date(commission.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {commission.status === 'pending' && (
                        <Select 
                          value={commission.status} 
                          onValueChange={(v) => updateStatus(commission.id, v)}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="approved">Approve</SelectItem>
                            <SelectItem value="cancelled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {commission.status === 'approved' && (
                        <Select 
                          value={commission.status} 
                          onValueChange={(v) => updateStatus(commission.id, v)}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid">Mark Paid</SelectItem>
                            <SelectItem value="cancelled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
