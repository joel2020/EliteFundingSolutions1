'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Copy, Plus, Users, TrendingUp, DollarSign, Mail, Phone } from 'lucide-react';
import type { IsoBroker } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getIsoQuality } from '@/lib/crm-intelligence';

interface BrokerFormData {
  company_name: string;
  broker_name: string;
  email: string;
  phone: string;
  commission_pct: string;
  payment_terms: string;
  notes: string;
}

const emptyForm: BrokerFormData = {
  company_name: '',
  broker_name: '',
  email: '',
  phone: '',
  commission_pct: '5',
  payment_terms: 'Paid on funded deals',
  notes: '',
};

function slugifyBroker(companyName: string, brokerName: string) {
  const base = [companyName, brokerName].filter(Boolean).join('-') || 'iso-broker';
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 72);
  return slug || 'iso-broker';
}

function brokerApplicationUrl(slug?: string | null) {
  if (!slug) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/apply/iso/${slug}`;
}

export default function IsoBrokersPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [brokers, setBrokers] = useState<IsoBroker[]>([]);
  const [commissions, setCommissions] = useState<Record<string, any>[]>([]);
  const [deals, setDeals] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState<BrokerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadBrokers = useCallback(async () => {
    if (!organizationId) return;
    const [brokerResult, commissionResult, dealResult] = await Promise.all([
      supabase.from('iso_brokers').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('commissions').select('id,iso_broker_id,deal_id,commission_amount,payment_status').eq('organization_id', organizationId),
      supabase.from('deals').select('id,stage_slug,funded_at,funded_amount').eq('organization_id', organizationId).is('deleted_at', null),
    ]);

    if (brokerResult.error) {
      toast.error('Failed to load brokers');
      console.error(brokerResult.error);
    } else if (brokerResult.data) {
      setBrokers(brokerResult.data as IsoBroker[]);
      setCommissions(commissionResult.data || []);
      setDeals(dealResult.data || []);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadBrokers();
  }, [crmUserLoading, organizationId, loadBrokers]);

  const saveBroker = async () => {
    if (!formData.company_name || !formData.broker_name) {
      toast.error('Company and broker name are required');
      return;
    }

    setSaving(true);
    
    const brokerData = {
      organization_id: organizationId,
      company_name: formData.company_name,
      broker_name: formData.broker_name,
      email: formData.email || null,
      phone: formData.phone || null,
      commission_pct: parseFloat(formData.commission_pct) || 5,
      payment_terms: formData.payment_terms || null,
      notes: formData.notes || null,
      is_active: true,
      application_slug: `${slugifyBroker(formData.company_name, formData.broker_name)}-${Date.now().toString(36)}`,
    };

    const { error } = await supabase
      .from('iso_brokers')
      .insert([brokerData]);

    if (error) {
      toast.error('Failed to add broker');
      console.error(error);
    } else {
      toast.success('Broker added successfully');
      setShowDialog(false);
      setFormData(emptyForm);
      loadBrokers();
    }
    
    setSaving(false);
  };

  const toggleActive = async (brokerId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('iso_brokers')
      .update({ is_active: !currentStatus })
      .eq('id', brokerId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Broker ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadBrokers();
    }
  };

  const copyApplicationLink = async (broker: IsoBroker) => {
    const url = brokerApplicationUrl((broker as any).application_slug);
    if (!url) {
      toast.error('This broker does not have an application link yet.');
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Broker application link copied');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="ISO / Brokers"
        subtitle={`${brokers.length} broker partners`}
        actions={
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Broker
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Total Brokers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">{brokers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {brokers.filter(b => b.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[#71717A]">Avg Commission</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#09090B]">
                {brokers.length > 0 
                  ? `${(brokers.reduce((sum, b) => sum + (b.commission_pct || 0), 0) / brokers.length).toFixed(1)}%`
                  : '0%'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Brokers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12 text-[#A1A1AA]">Loading…</div>
          ) : brokers.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" />
              <p className="text-[#71717A] mb-4">No brokers added yet</p>
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Broker
              </Button>
            </div>
          ) : (
            brokers.map((broker) => {
              const quality = getIsoQuality(broker, commissions, deals);
              return (
              <div
                key={broker.id}
                className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-[#09090B] mb-1">{broker.company_name}</h3>
                    <p className="text-sm text-[#71717A]">{broker.broker_name}</p>
                  </div>
                  <Badge className={broker.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {broker.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="rounded-[8px] border border-[#E4E4E7] bg-[#F8FAFC] p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase text-[#71717A]">Application link</span>
                      <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => copyApplicationLink(broker)}>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                    <code className="block truncate text-[11px] text-[#52525B]">{(broker as any).application_slug ? `/apply/iso/${(broker as any).application_slug}` : 'Not generated'}</code>
                  </div>
                  {broker.email && (
                    <div className="flex items-center gap-2 text-sm text-[#52525B]">
                      <Mail className="w-4 h-4 text-[#71717A]" />
                      <a href={`mailto:${broker.email}`} className="hover:text-[#2563EB]">
                        {broker.email}
                      </a>
                    </div>
                  )}
                  {broker.phone && (
                    <div className="flex items-center gap-2 text-sm text-[#52525B]">
                      <Phone className="w-4 h-4 text-[#71717A]" />
                      <a href={`tel:${broker.phone}`} className="hover:text-[#2563EB]">
                        {broker.phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-[#71717A]" />
                    <span className="font-semibold text-[#09090B]">
                      {broker.commission_pct}% Commission
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="rounded-[8px] bg-[#F4F4F5] p-2"><div className="text-[11px] text-[#A1A1AA]">Quality</div><div className="text-[13px] font-semibold text-[#09090B]">{quality.score}</div></div>
                  <div className="rounded-[8px] bg-[#F4F4F5] p-2"><div className="text-[11px] text-[#A1A1AA]">Approval</div><div className="text-[13px] font-semibold text-[#09090B]">{quality.approvalRate}%</div></div>
                  <div className="rounded-[8px] bg-[#F4F4F5] p-2"><div className="text-[11px] text-[#A1A1AA]">Funded</div><div className="text-[13px] font-semibold text-[#09090B]">${Math.round(quality.fundedVolume / 1000)}K</div></div>
                </div>

                {broker.notes && (
                  <div className="text-xs text-[#71717A] mb-4 p-3 bg-[#F4F4F5] rounded-lg">
                    {broker.notes}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => toggleActive(broker.id, broker.is_active)}
                >
                  {broker.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            ); })
          )}
        </div>
      </div>

      {/* Add Broker Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add ISO / Broker</DialogTitle>
            <DialogDescription>
              Add a new broker or ISO partner
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="company_name">Company Name *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="broker_name">Broker Name *</Label>
              <Input
                id="broker_name"
                value={formData.broker_name}
                onChange={(e) => setFormData({ ...formData, broker_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="commission_pct">Commission %</Label>
              <Input
                id="commission_pct"
                type="number"
                step="0.1"
                value={formData.commission_pct}
                onChange={(e) => setFormData({ ...formData, commission_pct: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveBroker} disabled={saving}>
              {saving ? 'Adding...' : 'Add Broker'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
