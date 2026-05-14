'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Search, Plus, MoreVertical, Phone, Mail, Trash2, Edit, Eye } from 'lucide-react';
import type { Lead } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  new: { label: 'New', bg: '#EFF6FF', text: '#2563EB' },
  contacted: { label: 'Contacted', bg: '#FFFBEB', text: '#D97706' },
  qualified: { label: 'Qualified', bg: '#F0FDF4', text: '#059669' },
  application_started: { label: 'App Started', bg: '#F5F3FF', text: '#7C3AED' },
  converted: { label: 'Converted', bg: '#F0FDF4', text: '#059669' },
  lost: { label: 'Lost', bg: '#FEF2F2', text: '#DC2626' },
  unresponsive: { label: 'Unresponsive', bg: '#F4F4F5', text: '#71717A' },
};

const sourceOptions = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'broker', label: 'Broker' },
  { value: 'iso', label: 'ISO' },
  { value: 'paid_ads', label: 'Paid Ads' },
  { value: 'organic_search', label: 'Organic Search' },
  { value: 'cold_email', label: 'Cold Email' },
  { value: 'partner', label: 'Partner' },
  { value: 'manual_entry', label: 'Manual Entry' },
];

interface LeadFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  business_name: string;
  lead_source: string;
  status: string;
  notes: string;
}

const emptyForm: LeadFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  business_name: '',
  lead_source: 'website',
  status: 'new',
  notes: '',
};

export default function LeadsPage() {
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'kanban'>('list');
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState<LeadFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadLeads = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load leads');
      console.error(error);
    } else if (data) {
      setLeads(data as Lead[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadLeads();
  }, [crmUserLoading, organizationId, loadLeads]);

  const handleAdd = () => {
    setFormData(emptyForm);
    setShowAddDialog(true);
  };

  const handleEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email || '',
      phone: lead.phone || '',
      business_name: lead.business_name || '',
      lead_source: lead.lead_source,
      status: lead.status,
      notes: lead.notes || '',
    });
    setShowEditDialog(true);
  };

  const handleDelete = (lead: Lead) => {
    setSelectedLead(lead);
    setShowDeleteDialog(true);
  };

  const saveLead = async () => {
    setSaving(true);
    
    const leadData = {
      ...formData,
      organization_id: organizationId,
    };

    if (selectedLead) {
      // Update
      const { error } = await supabase
        .from('leads')
        .update(leadData)
        .eq('id', selectedLead.id);

      if (error) {
        toast.error('Failed to update lead');
        console.error(error);
      } else {
        toast.success('Lead updated successfully');
        setShowEditDialog(false);
        loadLeads();
      }
    } else {
      // Create
      const { error } = await supabase
        .from('leads')
        .insert([leadData]);

      if (error) {
        toast.error('Failed to create lead');
        console.error(error);
      } else {
        toast.success('Lead created successfully');
        setShowAddDialog(false);
        loadLeads();
      }
    }
    
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!selectedLead) return;
    
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', selectedLead.id);

    if (error) {
      toast.error('Failed to delete lead');
      console.error(error);
    } else {
      toast.success('Lead deleted successfully');
      setShowDeleteDialog(false);
      loadLeads();
    }
    setSaving(false);
  };

  const updateStatus = async (leadId: string, newStatus: string) => {
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      loadLeads();
    }
  };

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
      (l.business_name ?? '').toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q)
    );
  });

  const groupedByStatus = Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = filtered.filter(l => l.status === status);
    return acc;
  }, {} as Record<string, Lead[]>);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Leads"
        subtitle={`${leads.length} leads in your pipeline`}
        actions={
          <div className="flex items-center gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'kanban')}>
              <TabsList>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              New Lead
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Search */}
        <div className="relative max-w-[320px] mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <Input
            type="text"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {view === 'list' ? (
          <div className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F4F4F5]">
                  {['Contact', 'Business', 'Source', 'Status', 'Phone', 'Email', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#A1A1AA]">Loading…</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#A1A1AA]">No leads found</td>
                  </tr>
                ) : (
                  filtered.map((lead) => (
                    <tr key={lead.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#09090B]">{lead.first_name} {lead.last_name}</div>
                      </td>
                      <td className="px-4 py-3 text-[#52525B]">{lead.business_name || '—'}</td>
                      <td className="px-4 py-3 text-[#52525B] text-sm capitalize">{lead.lead_source.replace('_', ' ')}</td>
                      <td className="px-4 py-3">
                        <Select value={lead.status} onValueChange={(v) => updateStatus(lead.id, v)}>
                          <SelectTrigger className="w-[140px] h-8">
                            <span
                              className="inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-semibold"
                              style={{ backgroundColor: statusConfig[lead.status]?.bg, color: statusConfig[lead.status]?.text }}
                            >
                              {statusConfig[lead.status]?.label || lead.status}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>{config.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-[#52525B]">
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-[#2563EB]">
                            <Phone className="w-3 h-3" />
                            {lead.phone}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-[#52525B]">
                        {lead.email ? (
                          <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-[#2563EB]">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(lead)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(lead)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {Object.entries(statusConfig).map(([status, config]) => (
              <div key={status} className="flex-shrink-0 w-[300px]">
                <div className="bg-[#F4F4F5] rounded-t-lg px-4 py-3 flex items-center justify-between">
                  <span className="font-semibold text-sm text-[#09090B]">{config.label}</span>
                  <span className="text-xs bg-white rounded-full px-2 py-0.5 text-[#71717A]">
                    {groupedByStatus[status]?.length || 0}
                  </span>
                </div>
                <div className="bg-[#FAFAFA] p-2 space-y-2 min-h-[200px] rounded-b-lg">
                  {groupedByStatus[status]?.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white border border-[#E4E4E7] rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => handleEdit(lead)}
                    >
                      <div className="font-medium text-sm text-[#09090B] mb-1">
                        {lead.first_name} {lead.last_name}
                      </div>
                      {lead.business_name && (
                        <div className="text-xs text-[#71717A] mb-2">{lead.business_name}</div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                        {lead.phone && <Phone className="w-3 h-3" />}
                        {lead.email && <Mail className="w-3 h-3" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        setShowAddDialog(false);
        setShowEditDialog(false);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedLead ? 'Edit Lead' : 'New Lead'}</DialogTitle>
            <DialogDescription>
              {selectedLead ? 'Update lead information' : 'Add a new lead to your pipeline'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
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
            <div className="col-span-2">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lead_source">Lead Source</Label>
              <Select value={formData.lead_source} onValueChange={(v) => setFormData({ ...formData, lead_source: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setShowEditDialog(false); }}>
              Cancel
            </Button>
            <Button onClick={saveLead} disabled={saving || !formData.first_name || !formData.last_name}>
              {saving ? 'Saving...' : selectedLead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedLead?.first_name} {selectedLead?.last_name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
