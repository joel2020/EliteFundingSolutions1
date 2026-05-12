'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { Plus, DollarSign, TrendingUp, Calendar, Building2, Send } from 'lucide-react';
import type { Offer } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const offerTerms = [
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '9', label: '9 months' },
  { value: '12', label: '12 months' },
  { value: '18', label: '18 months' },
  { value: '24', label: '24 months' },
];

const paymentFrequency = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

interface OfferFormData {
  business_name: string;
  funding_amount: string;
  factor_rate: string;
  term_months: string;
  payment_frequency: string;
  holdback_percentage: string;
}

const emptyForm: OfferFormData = {
  business_name: '',
  funding_amount: '',
  factor_rate: '1.25',
  term_months: '6',
  payment_frequency: 'daily',
  holdback_percentage: '10',
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState<OfferFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load offers');
      console.error(error);
    } else if (data) {
      setOffers(data as Offer[]);
    }
    setLoading(false);
  };

  const calculateOffer = () => {
    const fundingAmount = parseFloat(formData.funding_amount) || 0;
    const factorRate = parseFloat(formData.factor_rate) || 1.25;
    const termMonths = parseInt(formData.term_months) || 6;
    const holdbackPct = parseFloat(formData.holdback_percentage) || 10;

    const totalPayback = fundingAmount * factorRate;
    const totalCost = totalPayback - fundingAmount;
    
    let paymentAmount = 0;
    let paymentsCount = 0;
    
    if (formData.payment_frequency === 'daily') {
      paymentsCount = termMonths * 22; // ~22 business days per month
      paymentAmount = totalPayback / paymentsCount;
    } else if (formData.payment_frequency === 'weekly') {
      paymentsCount = termMonths * 4;
      paymentAmount = totalPayback / paymentsCount;
    } else {
      paymentsCount = termMonths;
      paymentAmount = totalPayback / paymentsCount;
    }

    return {
      fundingAmount,
      totalPayback,
      totalCost,
      paymentAmount,
      paymentsCount,
      holdbackPct,
    };
  };

  const calculations = calculateOffer();

  const handleAdd = () => {
    setFormData(emptyForm);
    setShowDialog(true);
  };

  const saveOffer = async () => {
    if (!formData.business_name || !formData.funding_amount) {
      toast.error('Business name and funding amount are required');
      return;
    }

    setSaving(true);
    
    const calc = calculateOffer();
    
    const offerData = {
      organization_id: DEFAULT_ORG_ID,
      business_name: formData.business_name,
      funding_amount: calc.fundingAmount,
      factor_rate: parseFloat(formData.factor_rate),
      total_payback: calc.totalPayback,
      payment_amount: calc.paymentAmount,
      term_months: parseInt(formData.term_months),
      payment_frequency: formData.payment_frequency,
      holdback_percentage: calc.holdbackPct,
      status: 'draft',
    };

    const { error } = await supabase
      .from('offers')
      .insert([offerData]);

    if (error) {
      toast.error('Failed to create offer');
      console.error(error);
    } else {
      toast.success('Offer created successfully');
      setShowDialog(false);
      loadOffers();
    }
    
    setSaving(false);
  };

  const sendOffer = async (offerId: string) => {
    const { error } = await supabase
      .from('offers')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', offerId);

    if (error) {
      toast.error('Failed to send offer');
    } else {
      toast.success('Offer sent to client');
      loadOffers();
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-purple-100 text-purple-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    expired: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Offers"
        subtitle={`${offers.length} offers created`}
        actions={
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Create Offer
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Total Offers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">{offers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Accepted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {offers.filter(o => o.status === 'accepted').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {offers.filter(o => ['sent', 'viewed'].includes(o.status)).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">
                ${offers.reduce((sum, o) => sum + (o.funding_amount || 0), 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12 text-[#A1A1AA]">Loading…</div>
          ) : offers.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" />
              <p className="text-[#71717A] mb-4">No offers created yet</p>
              <Button onClick={handleAdd}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Offer
              </Button>
            </div>
          ) : (
            offers.map((offer) => (
              <div
                key={offer.id}
                className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#71717A]" />
                    <h3 className="font-semibold text-[#09090B]">{offer.business_name}</h3>
                  </div>
                  <Badge className={statusColors[offer.status] || 'bg-gray-100'}>
                    {offer.status}
                  </Badge>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#71717A]">Funding Amount</span>
                    <span className="font-semibold text-lg text-[#09090B]">
                      ${offer.funding_amount?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#71717A]">Total Payback</span>
                    <span className="font-semibold text-[#09090B]">
                      ${offer.total_payback?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#71717A]">Payment</span>
                    <span className="font-semibold text-[#09090B]">
                      ${offer.payment_amount?.toLocaleString()} {offer.payment_frequency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#71717A]">Factor Rate</span>
                    <span className="font-semibold text-[#09090B]">
                      {offer.factor_rate}x
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#71717A]">Term</span>
                    <span className="font-semibold text-[#09090B]">
                      {offer.term_months} months
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E4E4E7]">
                  {offer.status === 'draft' ? (
                    <Button 
                      className="w-full" 
                      size="sm"
                      onClick={() => sendOffer(offer.id)}
                    >
                      <Send className="w-3 h-3 mr-2" />
                      Send to Client
                    </Button>
                  ) : (
                    <div className="text-xs text-[#71717A] text-center">
                      {offer.sent_at && (
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Sent {new Date(offer.sent_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Offer Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Funding Offer</DialogTitle>
            <DialogDescription>
              Generate a funding offer with automatic calculations
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="funding_amount">Funding Amount *</Label>
              <Input
                id="funding_amount"
                type="number"
                value={formData.funding_amount}
                onChange={(e) => setFormData({ ...formData, funding_amount: e.target.value })}
                placeholder="50000"
              />
            </div>
            
            <div>
              <Label htmlFor="factor_rate">Factor Rate</Label>
              <Input
                id="factor_rate"
                type="number"
                step="0.01"
                value={formData.factor_rate}
                onChange={(e) => setFormData({ ...formData, factor_rate: e.target.value })}
              />
            </div>
            
            <div>
              <Label htmlFor="term_months">Term</Label>
              <Select value={formData.term_months} onValueChange={(v) => setFormData({ ...formData, term_months: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {offerTerms.map((term) => (
                    <SelectItem key={term.value} value={term.value}>{term.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="payment_frequency">Payment Frequency</Label>
              <Select value={formData.payment_frequency} onValueChange={(v) => setFormData({ ...formData, payment_frequency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentFrequency.map((freq) => (
                    <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="holdback_percentage">Holdback %</Label>
              <Input
                id="holdback_percentage"
                type="number"
                step="0.1"
                value={formData.holdback_percentage}
                onChange={(e) => setFormData({ ...formData, holdback_percentage: e.target.value })}
              />
            </div>
            
            {/* Calculations Preview */}
            <div className="col-span-2 mt-2">
              <div className="bg-[#F4F4F5] rounded-lg p-4 space-y-2">
                <div className="text-sm font-semibold text-[#09090B] mb-3">Offer Summary</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Funding Amount:</span>
                    <span className="font-semibold">${calculations.fundingAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Total Payback:</span>
                    <span className="font-semibold">${calculations.totalPayback.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Total Cost:</span>
                    <span className="font-semibold text-orange-600">${calculations.totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Payment Amount:</span>
                    <span className="font-semibold">${calculations.paymentAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]"># of Payments:</span>
                    <span className="font-semibold">{calculations.paymentsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Holdback:</span>
                    <span className="font-semibold">{calculations.holdbackPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveOffer} disabled={saving || !formData.business_name || !formData.funding_amount}>
              {saving ? 'Creating...' : 'Create Offer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
