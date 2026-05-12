'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { RefreshCw, TrendingUp, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import type { Renewal } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const statusColors: Record<string, string> = {
  eligible: 'bg-green-100 text-green-700',
  contacted: 'bg-blue-100 text-blue-700',
  offer_sent: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-700',
};

export default function RenewalsPage() {
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect() => {
    loadRenewals();
  }, []);

  const loadRenewals = async () => {
    const { data, error } = await supabase
      .from('renewals')
      .select('*')
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load renewals');
      console.error(error);
    } else if (data) {
      setRenewals(data as Renewal[]);
    }
    setLoading(false);
  };

  const updateStatus = async (renewalId: string, newStatus: string) => {
    const { error } = await supabase
      .from('renewals')
      .update({ status: newStatus })
      .eq('id', renewalId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      loadRenewals();
    }
  };

  const calculatePaybackProgress = (renewal: Renewal) => {
    if (!renewal.original_amount || !renewal.amount_paid) return 0;
    return Math.min(100, (renewal.amount_paid / renewal.original_amount) * 100);
  };

  const eligibleRenewals = renewals.filter(r => r.status === 'eligible');
  const totalRenewalValue = eligibleRenewals.reduce((sum, r) => sum + (r.renewal_amount || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Renewals"
        subtitle={`${renewals.length} renewal opportunities`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Eligible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{eligibleRenewals.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Potential Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">
                ${totalRenewalValue.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {renewals.filter(r => ['contacted', 'offer_sent'].includes(r.status)).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">
                {renewals.filter(r => r.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Renewals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12 text-[#A1A1AA]">Loading…</div>
          ) : renewals.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" />
              <p className="text-[#71717A]">No renewal opportunities yet</p>
            </div>
          ) : (
            renewals.map((renewal) => {
              const progress = calculatePaybackProgress(renewal);
              return (
                <div
                  key={renewal.id}
                  className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-[#09090B] mb-1">{renewal.business_name}</h3>
                      <Badge className={statusColors[renewal.status]}>
                        {renewal.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-green-600" />
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#71717A]">Payback Progress</span>
                        <span className="font-semibold">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-[#71717A]">Original Amount:</span>
                      <span className="font-semibold">${renewal.original_amount?.toLocaleString() || '—'}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-[#71717A]">Amount Paid:</span>
                      <span className="font-semibold text-green-600">
                        ${renewal.amount_paid?.toLocaleString() || '0'}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-[#71717A]">Balance:</span>
                      <span className="font-semibold text-orange-600">
                        ${((renewal.original_amount || 0) - (renewal.amount_paid || 0)).toLocaleString()}
                      </span>
                    </div>

                    {renewal.renewal_amount && (
                      <div className="flex justify-between text-sm pt-2 border-t border-[#E4E4E7]">
                        <span className="text-[#71717A]">Renewal Amount:</span>
                        <span className="font-semibold text-[#09090B]">
                          ${renewal.renewal_amount.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {renewal.status === 'eligible' && (
                    <div className="space-y-2">
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => updateStatus(renewal.id, 'contacted')}
                      >
                        Contact Client
                      </Button>
                    </div>
                  )}

                  {renewal.status === 'contacted' && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => updateStatus(renewal.id, 'offer_sent')}
                    >
                      Send Offer
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
