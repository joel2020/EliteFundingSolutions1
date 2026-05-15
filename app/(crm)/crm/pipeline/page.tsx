'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Plus, DollarSign, Building2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const stages = [
  { id: 'lead_captured', label: 'Lead Captured', color: '#71717A' },
  { id: 'application_started', label: 'Application Started', color: '#F59E0B' },
  { id: 'application_submitted', label: 'Application Submitted', color: '#2563EB' },
  { id: 'documents_requested', label: 'Documents Requested', color: '#F59E0B' },
  { id: 'documents_received', label: 'Documents Received', color: '#2563EB' },
  { id: 'underwriting_review', label: 'Underwriting Review', color: '#7C3AED' },
  { id: 'submitted_to_partners', label: 'Submitted to Partners', color: '#2563EB' },
  { id: 'offers_received', label: 'Offers Received', color: '#10B981' },
  { id: 'offer_presented', label: 'Offer Presented', color: '#10B981' },
  { id: 'contract_sent', label: 'Contract Sent', color: '#F59E0B' },
  { id: 'contract_signed', label: 'Contract Signed', color: '#10B981' },
  { id: 'funded', label: 'Funded', color: '#10B981' },
  { id: 'renewal_eligible', label: 'Renewal Eligible', color: '#2563EB' },
  { id: 'declined', label: 'Declined', color: '#EF4444' },
  { id: 'lost_unresponsive', label: 'Lost / Unresponsive', color: '#A1A1AA' },
];

interface DealFormData {
  business_name: string;
  contact_name: string;
  requested_amount: string;
  stage: string;
}

const emptyForm: DealFormData = {
  business_name: '',
  contact_name: '',
  requested_amount: '',
  stage: 'lead_captured',
};

export default function PipelinePage() {
  const router = useRouter();
  const { organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState<DealFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadDeals = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('deals')
      .select('id,title,business_id,stage_slug,requested_amount,funded_amount,created_at,businesses(legal_name,dba)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load deals');
      console.error(error);
    } else if (data) {
      setDeals(data as any[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { toast.error(crmUserError || 'Your CRM profile is not active.'); setLoading(false); return; }
    loadDeals();
  }, [crmUserLoading, organizationId, crmUserError, loadDeals]);

  const handleAdd = () => {
    setFormData(emptyForm);
    setShowDialog(true);
  };

  const saveDeal = async () => {
    if (!formData.business_name || !formData.requested_amount) {
      toast.error('Business name and amount are required');
      return;
    }

    setSaving(true);

    const dealData = {
      organization_id: organizationId,
      title: formData.business_name,
      requested_amount: parseFloat(formData.requested_amount),
      stage_slug: formData.stage,
    };

    const { error } = await supabase
      .from('deals')
      .insert([dealData]);

    if (error) {
      toast.error('Failed to create deal');
      console.error(error);
    } else {
      toast.success('Deal created successfully');
      setShowDialog(false);
      loadDeals();
    }

    setSaving(false);
  };

  const moveToStage = async (dealId: string, newStage: string) => {
    const { error } = await supabase
      .from('deals')
      .update({ stage_slug: newStage })
      .eq('id', dealId)
      .eq('organization_id', organizationId);

    if (error) {
      toast.error('Failed to move deal');
    } else {
      toast.success('Deal moved');
      loadDeals();
    }
  };

  const groupedDeals = stages.reduce((acc, stage) => {
    acc[stage.id] = deals.filter(d => d.stage_slug === stage.id);
    return acc;
  }, {} as Record<string, any[]>);

  const totalValue = deals.reduce((sum, d) => sum + (d.requested_amount || 0), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Pipeline"
        subtitle={`${deals.length} deals • $${totalValue.toLocaleString()} total value`}
        actions={
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            New Deal
          </Button>
        }
      />

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-4 h-full pb-4">
          {stages.map((stage) => {
            const stageDeals = groupedDeals[stage.id] || [];
            const stageValue = stageDeals.reduce((sum, d) => sum + (d.requested_amount || 0), 0);

            return (
              <div key={stage.id} className="flex-shrink-0 w-[320px] flex flex-col">
                <div
                  className="rounded-t-lg px-4 py-3 flex items-center justify-between"
                  style={{ backgroundColor: `${stage.color}15` }}
                >
                  <div>
                    <span className="font-semibold text-sm" style={{ color: stage.color }}>
                      {stage.label}
                    </span>
                    <div className="text-xs text-[#71717A] mt-0.5">
                      ${stageValue.toLocaleString()}
                    </div>
                  </div>
                  <span className="text-xs bg-white rounded-full px-2 py-0.5 text-[#71717A] font-medium">
                    {stageDeals.length}
                  </span>
                </div>

                <div className="bg-[#FAFAFA] p-2 space-y-2 flex-1 overflow-y-auto rounded-b-lg">
                  {loading ? (
                    <div className="text-center py-8 text-[#A1A1AA] text-sm">Loading…</div>
                  ) : stageDeals.length === 0 ? (
                    <div className="text-center py-8 text-[#A1A1AA] text-sm">No deals</div>
                  ) : (
                    stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        onClick={() => router.push(`/crm/deals/${deal.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') router.push(`/crm/deals/${deal.id}`);
                        }}
                        className="bg-white border border-[#E4E4E7] rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#71717A]" />
                            <span className="font-medium text-sm text-[#09090B]">
                              {deal.businesses?.legal_name || deal.businesses?.dba || deal.title || 'Unnamed business'}
                            </span>
                          </div>
                        </div>

                        {deal.business_id && (
                          <div className="flex items-center gap-1 text-xs text-[#71717A] mb-2">
                            <User className="w-3 h-3" />
                            Linked business
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-sm font-semibold text-[#09090B]">
                            <DollarSign className="w-4 h-4" />
                            {deal.requested_amount?.toLocaleString() || '0'}
                          </div>

                          <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                            <Select
                              value={deal.stage_slug}
                              onValueChange={(newStage) => moveToStage(deal.id, newStage)}
                            >
                              <SelectTrigger className="w-[100px] h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {stages.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="text-xs text-[#A1A1AA] mt-2">
                          {new Date(deal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Deal</DialogTitle>
            <DialogDescription>Add a new deal to your pipeline</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="requested_amount">Requested Amount *</Label>
              <Input
                id="requested_amount"
                type="number"
                value={formData.requested_amount}
                onChange={(e) => setFormData({ ...formData, requested_amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="stage">Stage</Label>
              <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveDeal} disabled={saving}>
              {saving ? 'Creating...' : 'Create Deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
