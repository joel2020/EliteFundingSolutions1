'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Plus, DollarSign, Calendar, Building2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    if (!organizationId) { setLoading(false); return; }
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
    if (!organizationId || !formData.deal_id || !formData.approved_amount) { toast.error('Deal and approved amount are required'); return; }
    setSaving(true);
    const { error } = await supabase.from('offers').insert([{ organization_id: organizationId, deal_id: formData.deal_id, approved_amount: calculations.approvedAmount, factor_rate: parseFloat(formData.factor_rate), payback_amount: calculations.paybackAmount, term_days: parseInt(formData.term_days), payment_frequency: formData.payment_frequency, daily_payment: calculations.dailyPayment, weekly_payment: calculations.weeklyPayment, holdback_pct: parseFloat(formData.holdback_pct), status: 'received' }]);
    if (error) { toast.error('Failed to create offer'); console.error(error); } else { toast.success('Offer created'); setShowDialog(false); setFormData(emptyForm); loadData(); }
    setSaving(false);
  };

  const businessName = (offer: any) => offer.deals?.businesses?.legal_name || offer.deals?.businesses?.dba || offer.deals?.title || 'Unlinked deal';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar title="Offers" subtitle={`${offers.length} funding offers`} actions={<Button onClick={() => setShowDialog(true)}><Plus className="w-4 h-4 mr-2" />Create Offer</Button>} />
      <div className="flex-1 overflow-y-auto p-6 bg-[#F6F7FA]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"><Card><CardHeader><CardTitle className="text-sm">Total Offered</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">${offers.reduce((sum, o) => sum + Number(o.approved_amount || 0), 0).toLocaleString()}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Presented</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{offers.filter(o => o.status === 'presented').length}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Accepted</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{offers.filter(o => o.status === 'accepted').length}</div></CardContent></Card></div>
        {loading ? <div className="text-center py-12 text-[#A1A1AA]">Loading…</div> : offers.length === 0 ? <div className="rounded-[18px] border border-dashed bg-white py-16 text-center text-[#71717A]">No offers yet. Create offers from active deals.</div> : <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">{offers.map((offer) => <div key={offer.id} className="bg-white border border-[#E4E4E7] rounded-[16px] p-5"><div className="flex items-start justify-between mb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]"><Building2 className="w-5 h-5" /></div><div><h3 className="font-semibold text-[#09090B]">{businessName(offer)}</h3><p className="text-xs text-[#71717A]">Deal offer</p></div></div><Badge className={statusConfig[offer.status] || 'bg-gray-100 text-gray-700'}>{offer.status}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-[#71717A]">Approved</div><div className="font-bold text-[#09090B]">${Number(offer.approved_amount || 0).toLocaleString()}</div></div><div><div className="text-[#71717A]">Payback</div><div className="font-bold text-[#09090B]">${Number(offer.payback_amount || 0).toLocaleString()}</div></div><div><div className="text-[#71717A]">Factor</div><div className="font-bold text-[#09090B]">{offer.factor_rate || '—'}</div></div><div><div className="text-[#71717A]">Term</div><div className="font-bold text-[#09090B]">{offer.term_days || '—'} days</div></div></div><div className="flex items-center justify-between mt-4 pt-4 border-t text-xs text-[#A1A1AA]"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(offer.created_at).toLocaleDateString()}</span><Button size="sm" variant="outline"><Send className="w-3 h-3 mr-1" />Present</Button></div></div>)}</div>}
      </div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}><DialogContent><DialogHeader><DialogTitle>Create Offer</DialogTitle><DialogDescription>Create a schema-valid MCA offer linked to an active deal.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div><Label>Deal *</Label><Select value={formData.deal_id} onValueChange={(v) => setFormData({ ...formData, deal_id: v })}><SelectTrigger><SelectValue placeholder="Select deal" /></SelectTrigger><SelectContent>{deals.map((deal) => <SelectItem key={deal.id} value={deal.id}>{deal.businesses?.legal_name || deal.businesses?.dba || deal.title || deal.id}</SelectItem>)}</SelectContent></Select></div><div><Label>Approved Amount *</Label><Input value={formData.approved_amount} onChange={(e) => setFormData({ ...formData, approved_amount: e.target.value })} type="number" /></div><div className="grid grid-cols-2 gap-4"><div><Label>Factor Rate</Label><Input value={formData.factor_rate} onChange={(e) => setFormData({ ...formData, factor_rate: e.target.value })} type="number" step="0.01" /></div><div><Label>Term Days</Label><Input value={formData.term_days} onChange={(e) => setFormData({ ...formData, term_days: e.target.value })} type="number" /></div></div><div><Label>Payment Frequency</Label><Select value={formData.payment_frequency} onValueChange={(v) => setFormData({ ...formData, payment_frequency: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{paymentFrequency.map((frequency) => <SelectItem key={frequency.value} value={frequency.value}>{frequency.label}</SelectItem>)}</SelectContent></Select></div><div className="rounded-[12px] bg-[#F6F7FA] p-4 text-sm"><div className="flex justify-between"><span>Payback</span><strong>${calculations.paybackAmount.toLocaleString()}</strong></div><div className="flex justify-between"><span>Payment</span><strong>${Number(calculations.dailyPayment || calculations.weeklyPayment || 0).toFixed(2)}</strong></div></div></div><DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button><Button onClick={saveOffer} disabled={saving || !formData.deal_id || !formData.approved_amount}>{saving ? 'Creating…' : 'Create Offer'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
