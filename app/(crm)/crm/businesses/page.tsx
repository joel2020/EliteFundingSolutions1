'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Search, Plus, MoreVertical, Building2, Edit, Trash2, Users } from 'lucide-react';
import type { Business, Owner } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const entityTypes = [
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'llc', label: 'LLC' },
  { value: 's_corp', label: 'S Corporation' },
  { value: 'c_corp', label: 'C Corporation' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'non_profit', label: 'Non-Profit' },
  { value: 'other', label: 'Other' },
];

interface BusinessFormData {
  legal_name: string;
  dba: string;
  entity_type: string;
  ein: string;
  industry: string;
  start_date: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  monthly_gross_revenue: string;
  average_daily_balance: string;
  deposit_count_monthly: string;
  notes: string;
}

const emptyForm: BusinessFormData = {
  legal_name: '',
  dba: '',
  entity_type: 'llc',
  ein: '',
  industry: '',
  start_date: '',
  phone: '',
  email: '',
  website: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  monthly_gross_revenue: '',
  average_daily_balance: '',
  deposit_count_monthly: '',
  notes: '',
};

export default function BusinessesPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [formData, setFormData] = useState<BusinessFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadBusinesses = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load businesses');
      console.error(error);
    } else if (data) {
      setBusinesses(data as Business[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadBusinesses();
  }, [crmUserLoading, organizationId, loadBusinesses]);

  const handleAdd = () => {
    setSelectedBusiness(null);
    setFormData(emptyForm);
    setShowDialog(true);
  };

  const handleEdit = (business: Business) => {
    setSelectedBusiness(business);
    setFormData({
      legal_name: business.legal_name,
      dba: business.dba || '',
      entity_type: business.entity_type || 'llc',
      ein: '',
      industry: business.industry || '',
      start_date: business.start_date || '',
      phone: business.phone || '',
      email: business.email || '',
      website: business.website || '',
      address: business.address || '',
      city: business.city || '',
      state: business.state || '',
      zip: business.zip || '',
      monthly_gross_revenue: business.monthly_gross_revenue?.toString() || '',
      average_daily_balance: business.average_daily_balance?.toString() || '',
      deposit_count_monthly: business.deposit_count_monthly?.toString() || '',
      notes: business.notes || '',
    });
    setShowDialog(true);
  };

  const handleDelete = (business: Business) => {
    setSelectedBusiness(business);
    setShowDeleteDialog(true);
  };

  const saveBusiness = async () => {
    if (!formData.legal_name) {
      toast.error('Legal name is required');
      return;
    }

    setSaving(true);
    
    const { ein, ...schemaFormData } = formData;
    const businessData = {
      ...schemaFormData,
      organization_id: organizationId,
      start_date: formData.start_date || null,
      monthly_gross_revenue: formData.monthly_gross_revenue ? parseFloat(formData.monthly_gross_revenue) : null,
      average_daily_balance: formData.average_daily_balance ? parseFloat(formData.average_daily_balance) : null,
      deposit_count_monthly: formData.deposit_count_monthly ? parseInt(formData.deposit_count_monthly) : null,
    };

    if (selectedBusiness) {
      const { error } = await supabase
        .from('businesses')
        .update(businessData)
        .eq('id', selectedBusiness.id);

      if (error) {
        toast.error('Failed to update business');
        console.error(error);
      } else {
        toast.success('Business updated successfully');
        setShowDialog(false);
        loadBusinesses();
      }
    } else {
      const { error } = await supabase
        .from('businesses')
        .insert([businessData]);

      if (error) {
        toast.error('Failed to create business');
        console.error(error);
      } else {
        toast.success('Business created successfully');
        setShowDialog(false);
        loadBusinesses();
      }
    }
    
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!selectedBusiness) return;
    
    setSaving(true);
    const { error } = await supabase
      .from('businesses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', selectedBusiness.id);

    if (error) {
      toast.error('Failed to delete business');
      console.error(error);
    } else {
      toast.success('Business deleted successfully');
      setShowDeleteDialog(false);
      loadBusinesses();
    }
    setSaving(false);
  };

  const filtered = businesses.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.legal_name.toLowerCase().includes(q) ||
      (b.dba ?? '').toLowerCase().includes(q) ||
      (b.industry ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Businesses"
        subtitle={`${businesses.length} businesses`}
        actions={
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            New Business
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="relative max-w-[320px] mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <Input
            type="text"
            placeholder="Search businesses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12 text-[#A1A1AA]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-[#A1A1AA]">No businesses found</div>
          ) : (
            filtered.map((business) => (
              <div
                key={business.id}
                className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleEdit(business)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-[#09090B]">{business.legal_name}</div>
                      {business.dba && (
                        <div className="text-xs text-[#71717A]">DBA: {business.dba}</div>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(business); }}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(business); }} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 text-sm">
                  {business.industry && (
                    <div className="flex items-center gap-2 text-[#52525B]">
                      <Badge variant="secondary">{business.industry}</Badge>
                    </div>
                  )}
                  {business.monthly_gross_revenue && (
                    <div className="text-[#52525B]">
                      Revenue: <span className="font-semibold">${business.monthly_gross_revenue.toLocaleString()}/mo</span>
                    </div>
                  )}
                  {business.city && business.state && (
                    <div className="text-[#71717A] text-xs">
                      {business.city}, {business.state}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBusiness ? 'Edit Business' : 'New Business'}</DialogTitle>
            <DialogDescription>
              {selectedBusiness ? 'Update business information' : 'Add a new business to your CRM'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label htmlFor="legal_name">Legal Business Name *</Label>
              <Input
                id="legal_name"
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dba">DBA (Doing Business As)</Label>
              <Input
                id="dba"
                value={formData.dba}
                onChange={(e) => setFormData({ ...formData, dba: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="entity_type">Entity Type</Label>
              <Select value={formData.entity_type} onValueChange={(v) => setFormData({ ...formData, entity_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entityTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="monthly_gross_revenue">Monthly Revenue</Label>
              <Input
                id="monthly_gross_revenue"
                type="number"
                value={formData.monthly_gross_revenue}
                onChange={(e) => setFormData({ ...formData, monthly_gross_revenue: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="average_daily_balance">Avg Daily Balance</Label>
              <Input
                id="average_daily_balance"
                type="number"
                value={formData.average_daily_balance}
                onChange={(e) => setFormData({ ...formData, average_daily_balance: e.target.value })}
              />
            </div>
            <div className="col-span-2">
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
            <Button onClick={saveBusiness} disabled={saving || !formData.legal_name}>
              {saving ? 'Saving...' : selectedBusiness ? 'Update Business' : 'Create Business'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Business</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedBusiness?.legal_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete Business'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
