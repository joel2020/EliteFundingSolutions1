'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, Plus, Send } from 'lucide-react';
import { CrmTopbar } from '@/components/crm/topbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCrmUser } from '@/lib/crm-auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const paymentFrequency = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-weekly' },
];

const statusConfig: Record<string, string> = {
  received: 'bg-blue-100 text-blue-700',
  presented: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-700',
  withdrawn: 'bg-gray-100 text-gray-700',
};

const emptyForm = {
  deal_id: '',
  approved_amount: '',
  factor_rate: '1.25',
  term_days: '132',
  payment_frequency: 'daily',
  holdback_pct: '10',
};

export default function OffersPage() {
  const { organizationId, loading: crmUserLoading } = useCrmUser();
  const [offers, setOffers] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const [offersResult, dealsResult] = await Promise.all([
      supabase.from('offers').select('id,deal_id,approved_amount,factor_rate,payback_amount,term_days,payment_frequency,daily_payment,weekly_payment,holdback_pct,status,expires_at,created_at,deals(id,title,businesses(legal_name,dba))').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100),
      supabase.from('deals').select('id,title,requested_amount,stage_slug,businesses(legal_name,dba)').eq('organization_id', organizationId).is('deleted_at', null).in('stage_slug', ['underwriting_review', 'submitted_to_partners', 'offers_received', 'offer_presented']).order('created_at', { ascending: false }).limit(100),
    ]);

    if (offersResult.error || dealsResult.error) {
      toast.error('Failed to load offers');
      console.error(offersResult.error || dealsResult.error);
    } else {
      setOffers(offersResult.data || []);
      setDeals(dealsResult.data || []);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) {
      setLoading(false);
      return;
    }
    loadData();
  }, [crmUserLoading, organizationId, loadData]);

  const calculations = useMemo(() => {
    const approvedAmount = parseFloat(formData.approved_amount) || 0;
    const factorRate = parseFloat(formData.factor_rate) || 1.25;
    const termDays = parseInt(formData.term_days) || 132;
    const paybackAmount = approvedAmount * factorRate;
    const dailyPayment = formData.payment_frequency === 'daily' ? paybackAmount / Math.max(termDays, 1) : null;
    const weeklyPayment = formData.payment_frequency === 'weekly' ? paybackAmount / Math.max(Math.ceil(termDays / 7), 1) : null;
    return { approvedAmount, paybackAmount, dailyPayment, weeklyPayment };
  }, [formData]);

  const saveOffer = async () => {
    if (!organizationId || !formData.deal_id || !formData.approved_amount) {
      toast.error('Deal and approved amount are required');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('offers').insert([{
      organization_id: organizationId,
      deal_id: formData.deal_id,
      approved_amount: calculations.approvedAmount,
      factor_rate: parseFloat(formData.factor_rate),
      payback_amount: calculations.paybackAmount,
      term_days: parseInt(formData.term_days),
      payment_frequency: formData.payment_frequency,
      daily_payment: calculations.dailyPayment,
      weekly_payment: calculations.weeklyPayment,
      holdback_pct: parseFloat(formData.holdback_pct),
      status: 'received',
    }]);
    if (error) {
      toast.error('Failed to create offer');
      console.error(error);
    } else {
      toast.success('Offer created');
      setShowDialog(false);
      setFormData(emptyForm);
      loadData();
    }
    setSaving(false);
  };

  const presentOffer = async (offer: any) => {
    if (!organizationId) return;
    const { error } = await supabase
      .from('offers')
      .update({ status: 'presented' })
      .eq('id', offer.id)
      .eq('organization_id', organizationId);

    if (error) {
      toast.error('Failed to present offer');
      return;
    }

    if (offer.deal_id) {
      await fetch(`/api/crm/deals/${offer.deal_id}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_slug: 'offer_presented', notes: 'Offer presented from CRM offers page.' }),
      });
    }

    toast.success('Offer marked as presented');
    loadData();
  };

  const businessName = (offer: any) => offer.deals?.businesses?.legal_name || offer.deals?.businesses?.dba || offer.deals?.title || 'Unlinked deal';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar title="Offers" subtitle={`${offers.length} funding offers`} actions={<Button data-testid="create-offer" onClick={() => setShowDialog(true)}><Plus className="mr-2 h-4 w-4" />Create Offer</Button>} />
      <div className="flex-1 overflow-y-auto bg-[#F6F7FA] p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm">Total Offered</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${offers.reduce((sum, offer) => sum + Number(offer.approved_amount || 0), 0).toLocaleString()}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Presented</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{offers.filter((offer) => offer.status === 'presented').length}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Accepted</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{offers.filter((offer) => offer.status === 'accepted').length}</div></CardContent></Card>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#A1A1AA]">Loading...</div>
        ) : offers.length === 0 ? (
          <div className="rounded-[18px] border border-dashed bg-white py-16 text-center text-[#71717A]">No offers yet. Create offers from active deals.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {offers.map((offer) => (
              <div key={offer.id} className="rounded-[16px] border border-[#E4E4E7] bg-white p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]"><Building2 className="h-5 w-5" /></div>
                    <div><h3 className="font-semibold text-[#09090B]">{businessName(offer)}</h3><p className="text-xs text-[#71717A]">Deal offer</p></div>
                  </div>
                  <Badge className={statusConfig[offer.status] || 'bg-gray-100 text-gray-700'}>{offer.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-[#71717A]">Approved</div><div className="font-bold text-[#09090B]">${Number(offer.approved_amount || 0).toLocaleString()}</div></div>
                  <div><div className="text-[#71717A]">Payback</div><div className="font-bold text-[#09090B]">${Number(offer.payback_amount || 0).toLocaleString()}</div></div>
                  <div><div className="text-[#71717A]">Factor</div><div className="font-bold text-[#09090B]">{offer.factor_rate || '-'}</div></div>
                  <div><div className="text-[#71717A]">Term</div><div className="font-bold text-[#09090B]">{offer.term_days || '-'} days</div></div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-4 text-xs text-[#A1A1AA]">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(offer.created_at).toLocaleDateString()}</span>
                  <Button data-testid={`present-offer-${offer.id}`} size="sm" variant="outline" onClick={() => presentOffer(offer)} disabled={offer.status !== 'received'} title={offer.status === 'received' ? 'Mark this offer as presented to the merchant.' : 'Only received offers can be presented.'}>
                    <Send className="mr-1 h-3 w-3" />
                    {offer.status === 'received' ? 'Present' : 'Presented'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Offer</DialogTitle><DialogDescription>Create a schema-valid MCA offer linked to an active deal.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Deal *</Label><Select value={formData.deal_id} onValueChange={(value) => setFormData({ ...formData, deal_id: value })}><SelectTrigger data-testid="offer-deal"><SelectValue placeholder="Select deal" /></SelectTrigger><SelectContent>{deals.map((deal) => <SelectItem key={deal.id} value={deal.id}>{deal.businesses?.legal_name || deal.businesses?.dba || deal.title || deal.id}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Approved Amount *</Label><Input data-testid="offer-approved-amount" value={formData.approved_amount} onChange={(event) => setFormData({ ...formData, approved_amount: event.target.value })} type="number" /></div>
            <div className="grid grid-cols-2 gap-4"><div><Label>Factor Rate</Label><Input value={formData.factor_rate} onChange={(event) => setFormData({ ...formData, factor_rate: event.target.value })} type="number" step="0.01" /></div><div><Label>Term Days</Label><Input value={formData.term_days} onChange={(event) => setFormData({ ...formData, term_days: event.target.value })} type="number" /></div></div>
            <div><Label>Payment Frequency</Label><Select value={formData.payment_frequency} onValueChange={(value) => setFormData({ ...formData, payment_frequency: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentFrequency.map((frequency) => <SelectItem key={frequency.value} value={frequency.value}>{frequency.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="rounded-[12px] bg-[#F6F7FA] p-4 text-sm"><div className="flex justify-between"><span>Payback</span><strong>${calculations.paybackAmount.toLocaleString()}</strong></div><div className="flex justify-between"><span>Payment</span><strong>${Number(calculations.dailyPayment || calculations.weeklyPayment || 0).toFixed(2)}</strong></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button><Button data-testid="save-offer" onClick={saveOffer} disabled={saving || !formData.deal_id || !formData.approved_amount}>{saving ? 'Creating...' : 'Create Offer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
