'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Plus, Users, TrendingUp, DollarSign, Mail, Phone } from 'lucide-react';
import type { IsoBroker } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface BrokerFormData {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  commission_percentage: string;
  notes: string;
}

const emptyForm: BrokerFormData = {
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  commission_percentage: '5',
  notes: '',
};

export default function IsoBrokersPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [brokers, setBrokers] = useState<IsoBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState<BrokerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadBrokers();
  }, [crmUserLoading, organizationId]);

  const loadBrokers = async () => {
    const { data, error } = await supabase
      .from('iso_brokers')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load brokers');
      console.error(error);
    } else if (data) {
      setBrokers(data as IsoBroker[]);
    }
    setLoading(false);
  };

  const saveBroker = async () => {
    if (!formData.company_name || !formData.contact_name) {
      toast.error('Company and contact name are required');
      return;
    }

    setSaving(true);
    
    const brokerData = {
      organization_id: organizationId,
      company_name: formData.company_name,
      contact_name: formData.contact_name,
      email: formData.email || null,
      phone: formData.phone || null,
      commission_percentage: parseFloat(formData.commission_percentage) || 5,
      notes: formData.notes || null,
      is_active: true,
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
                  ? `${(brokers.reduce((sum, b) => sum + (b.commission_percentage || 0), 0) / brokers.length).toFixed(1)}%`
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
            brokers.map((broker) => (
              <div
                key={broker.id}
                className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-[#09090B] mb-1">{broker.company_name}</h3>
                    <p className="text-sm text-[#71717A]">{broker.contact_name}</p>
                  </div>
                  <Badge className={broker.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {broker.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
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
                      {broker.commission_percentage}% Commission
                    </span>
                  </div>
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
            ))
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
              <Label htmlFor="contact_name">Contact Name *</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
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
              <Label htmlFor="commission_percentage">Commission %</Label>
              <Input
                id="commission_percentage"
                type="number"
                step="0.1"
                value={formData.commission_percentage}
                onChange={(e) => setFormData({ ...formData, commission_percentage: e.target.value })}
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
