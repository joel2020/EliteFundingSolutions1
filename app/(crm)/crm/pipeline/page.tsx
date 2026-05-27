'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Plus, DollarSign, Building2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  business_id?: string;
  business_name: string;
  contact_name: string;
  requested_amount: string;
  stage: string;
}

const emptyForm: DealFormData = {
  business_id: '',
  business_name: '',
  contact_name: '',
  requested_amount: '',
  stage: 'lead_captured',
};

export default function PipelinePage() {
  const router = useRouter();
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [deals, setDeals] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [newClientMode, setNewClientMode] = useState(true);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState<DealFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadDeals = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select('id,title,business_id,stage_slug,requested_amount,funded_amount,created_at')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load deals');
      console.error(error);
    } else if (data) {
      const businessIds = Array.from(new Set(data.map((deal) => deal.business_id).filter(Boolean)));
      const { data: linkedBusinesses, error: businessError } = businessIds.length
        ? await supabase
            .from('businesses')
            .select('id,legal_name,dba')
            .eq('organization_id', organizationId)
            .in('id', businessIds)
        : { data: [], error: null };

      if (businessError) console.warn('Unable to load linked businesses for pipeline deals.', businessError);

      const businessesById = Object.fromEntries((linkedBusinesses || []).map((business) => [business.id, business]));
      setDeals(data.map((deal) => ({ ...deal, businesses: businessesById[deal.business_id] })) as any[]);
    }
    setLoading(false);
  }, [organizationId]);

  const loadBusinesses = useCallback(async () => {
    if (!organizationId) return;
    const { data } = await supabase
      .from('businesses')
      .select('id,legal_name,dba,email,phone,created_at')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    setBusinesses((data || []) as any[]);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadDeals();
    loadBusinesses();
  }, [crmUserLoading, organizationId, loadDeals, loadBusinesses]);

  const handleAdd = () => {
    setFormData(emptyForm);
    setClientSearch('');
    setNewClientMode(true);
    setDocumentFiles([]);
    setShowDialog(true);
  };

  const saveDeal = async () => {
    if ((!formData.business_id && !formData.business_name) || !formData.requested_amount) {
      toast.error('Business name and amount are required');
      return;
    }

    setSaving(true);
    
    const response = await fetch('/api/crm/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: formData.business_id || null,
        business_name: formData.business_name,
        contact_name: formData.contact_name,
        requested_amount: parseFloat(formData.requested_amount),
        stage_slug: formData.stage,
      }),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      toast.error(result.error || 'Failed to create deal');
    } else {
      for (const file of documentFiles) {
        const uploadData = new FormData();
        uploadData.set('file', file);
        uploadData.set('document_type', file.name.toLowerCase().includes('bank') ? 'bank_statement' : 'other');
        uploadData.set('label', file.name);
        await fetch(`/api/crm/deals/${result.dealId}/documents`, { method: 'POST', body: uploadData }).catch(() => null);
      }
      toast.success('Deal created successfully');
      setShowDialog(false);
      setFormData(emptyForm);
      setDocumentFiles([]);
      loadDeals();
    }
    
    setSaving(false);
  };

  const moveToStage = async (dealId: string, newStage: string) => {
    const response = await fetch(`/api/crm/deals/${dealId}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_slug: newStage, notes: 'Pipeline board stage update.' }),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      toast.error(result.error || 'Failed to move deal');
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
  const clientMatches = businesses
    .filter((business) => [business.legal_name, business.dba, business.email, business.phone].join(' ').toLowerCase().includes(clientSearch.toLowerCase()))
    .slice(0, 8);

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
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/crm/deals/${deal.id}`)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') router.push(`/crm/deals/${deal.id}`); }}
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

      {/* New Deal Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Deal</DialogTitle>
            <DialogDescription>Add a new deal to your pipeline</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="rounded-[8px] border border-[#E4E4E7] bg-[#FAFAFA] p-3">
              <div className="mb-2 flex gap-2">
                <Button type="button" size="sm" variant={newClientMode ? 'outline' : 'default'} onClick={() => setNewClientMode(false)}>Link existing client</Button>
                <Button type="button" size="sm" variant={newClientMode ? 'default' : 'outline'} onClick={() => { setNewClientMode(true); setFormData({ ...formData, business_id: '' }); }}>Create new client</Button>
              </div>
              {!newClientMode && (
                <div>
                  <Label htmlFor="client_search">Search client</Label>
                  <Input id="client_search" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Business, email, or phone" />
                  <div className="mt-2 max-h-[180px] overflow-y-auto rounded-[7px] border border-[#E4E4E7] bg-white">
                    {clientMatches.map((business) => (
                      <button
                        key={business.id}
                        type="button"
                        className={`block w-full border-b border-[#E4E4E7] px-3 py-2 text-left text-sm last:border-b-0 ${formData.business_id === business.id ? 'bg-[#EAF1FF]' : 'hover:bg-[#FAFAFA]'}`}
                        onClick={() => setFormData({ ...formData, business_id: business.id, business_name: business.legal_name || business.dba || '' })}
                      >
                        <b>{business.legal_name || business.dba || 'Unnamed business'}</b>
                        <span className="block text-xs text-[#71717A]">{business.email || business.phone || 'No contact saved'}</span>
                      </button>
                    ))}
                    {!clientMatches.length && <p className="p-3 text-sm text-[#71717A]">No matching clients.</p>}
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="business_name">{newClientMode ? 'Business Name *' : 'Selected Business'}</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                disabled={!newClientMode && !!formData.business_id}
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
            <div>
              <Label htmlFor="deal_documents">Upload required documents</Label>
              <Input
                id="deal_documents"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                onChange={(event) => setDocumentFiles(Array.from(event.target.files || []))}
              />
              {documentFiles.length > 0 && <p className="mt-1 text-xs text-[#71717A]">{documentFiles.length} file(s) will be attached after the deal is created.</p>}
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
