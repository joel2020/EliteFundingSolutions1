'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { FileSignature, Send, Eye, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { Contract } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileSignature },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  viewed: { label: 'Viewed', color: 'bg-purple-100 text-purple-700', icon: Eye },
  signed: { label: 'Signed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  voided: { label: 'Voided', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function ContractsPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContracts = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load contracts');
      console.error(error);
    } else if (data) {
      setContracts(data as Contract[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadContracts();
  }, [crmUserLoading, organizationId, loadContracts]);

  const sendContract = async (contractId: string) => {
    const response = await fetch(`/api/crm/contracts/${contractId}/send`, { method: 'POST' });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      toast.error(result.error || 'Failed to send contract');
    } else {
      toast.success('Contract sent to client');
      loadContracts();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Contracts"
        subtitle={`${contracts.length} contracts`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = contracts.filter(c => c.status === status).length;
            const Icon = config.icon;
            return (
              <Card key={status}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[#71717A] flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {config.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[#09090B]">{count}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Contracts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12 text-[#A1A1AA]">Loading…</div>
          ) : contracts.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <FileSignature className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" />
              <p className="text-[#71717A]">No contracts yet</p>
            </div>
          ) : (
            contracts.map((contract) => {
              const config = statusConfig[contract.status];
              const Icon = config?.icon || FileSignature;
              return (
                <div
                  key={contract.id}
                  className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#09090B]">{contract.contract_type || 'Contract'}</h3>
                        <p className="text-xs text-[#71717A]">{contract.business_name}</p>
                      </div>
                    </div>
                    <Badge className={config?.color}>
                      {config?.label || contract.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#71717A]">Amount:</span>
                      <span className="font-semibold">${contract.funding_amount?.toLocaleString() || '—'}</span>
                    </div>
                    {contract.sent_at && (
                      <div className="flex justify-between">
                        <span className="text-[#71717A]">Sent:</span>
                        <span className="text-[#52525B]">
                          {new Date(contract.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}
                    {contract.signed_at && (
                      <div className="flex justify-between">
                        <span className="text-[#71717A]">Signed:</span>
                        <span className="text-green-600">
                          {new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {contract.status === 'draft' && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => sendContract(contract.id)}
                    >
                      <Send className="w-3 h-3 mr-2" />
                      Send Contract
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
