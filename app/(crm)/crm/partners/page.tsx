'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CrmTopbar } from '@/components/crm/topbar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCrmUser } from '@/lib/crm-auth';
import { supabase } from '@/lib/supabase';
import type { FundingPartner } from '@/types/database';

const emptyPartner = {
  name: '',
  contact_name: '',
  email: '',
  phone: '',
  min_funding_amount: '',
  max_funding_amount: '',
  min_monthly_revenue: '',
  min_time_in_business_months: '',
  states_served: '',
  restricted_states: '',
  restricted_industries: '',
  preferred_industries: '',
  product_types: 'MCA, Revenue based financing',
  submission_email: '',
  portal_url: '',
  avg_approval_days: '',
  bonus_notes: '',
  notes: '',
};

export default function PartnersPage() {
  const { organizationId, loading: crmUserLoading } = useCrmUser();
  const [partners, setPartners] = useState<FundingPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPartner, setEditingPartner] = useState<FundingPartner | null>(null);
  const [form, setForm] = useState(emptyPartner);

  const loadPartners = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('funding_partners')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast.error('Failed to load funding partners');
      console.error(error);
    } else {
      setPartners((data || []) as FundingPartner[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) {
      setLoading(false);
      return;
    }
    loadPartners();
  }, [crmUserLoading, organizationId, loadPartners]);

  const partnerToForm = (partner: FundingPartner) => ({
    name: partner.name || '',
    contact_name: partner.contact_name || '',
    email: partner.email || '',
    phone: partner.phone || '',
    min_funding_amount: partner.min_funding_amount?.toString() || '',
    max_funding_amount: partner.max_funding_amount?.toString() || '',
    min_monthly_revenue: partner.min_monthly_revenue?.toString() || '',
    min_time_in_business_months: partner.min_time_in_business_months?.toString() || '',
    states_served: Array.isArray(partner.states_served) ? partner.states_served.join(', ') : '',
    restricted_states: Array.isArray(partner.restricted_states) ? partner.restricted_states.join(', ') : '',
    restricted_industries: Array.isArray(partner.restricted_industries) ? partner.restricted_industries.join(', ') : '',
    preferred_industries: Array.isArray(partner.preferred_industries) ? partner.preferred_industries.join(', ') : '',
    product_types: Array.isArray(partner.product_types) ? partner.product_types.join(', ') : '',
    submission_email: partner.submission_email || '',
    portal_url: partner.portal_url || '',
    avg_approval_days: partner.avg_approval_days?.toString() || '',
    bonus_notes: partner.bonus_notes || '',
    notes: partner.notes || '',
  });

  const openCreatePartner = () => {
    setEditingPartner(null);
    setForm(emptyPartner);
    setShowDialog(true);
  };

  const openEditPartner = (partner: FundingPartner) => {
    setEditingPartner(partner);
    setForm(partnerToForm(partner));
    setShowDialog(true);
  };

  const savePartner = async () => {
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (crmUserLoading) {
      toast.error('CRM profile is still loading. Try again in a moment.');
      return;
    }

    setSaving(true);
    const response = await fetch(editingPartner ? `/api/crm/partners/${editingPartner.id}` : '/api/crm/partners', {
      method: editingPartner ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        min_funding_amount: form.min_funding_amount || null,
        max_funding_amount: form.max_funding_amount || null,
        min_monthly_revenue: form.min_monthly_revenue || null,
        min_time_in_business_months: form.min_time_in_business_months || null,
        avg_approval_days: form.avg_approval_days || null,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      toast.error(result.error || 'Failed to save funding partner');
    } else {
      toast.success(editingPartner ? 'Funding partner updated' : 'Funding partner added');
      setShowDialog(false);
      setEditingPartner(null);
      setForm(emptyPartner);
      if (organizationId) loadPartners();
    }
    setSaving(false);
  };

  const deletePartner = async (partner: FundingPartner) => {
    if (!window.confirm(`Remove ${partner.name} from the active funder list? Existing deal history will stay intact.`)) return;
    const response = await fetch(`/api/crm/partners/${partner.id}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      toast.error(result.error || 'Failed to remove funding partner');
      return;
    }
    toast.success('Funding partner removed');
    loadPartners();
  };

  const fmt = (n: number | null) => (n ? `$${(n / 1000).toFixed(0)}K` : '-');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar
        title="Funding Partners"
        subtitle="Manage your lender and funder network"
        actions={<Button data-testid="add-partner" className="h-9 rounded-[8px] bg-[#2563EB]" onClick={openCreatePartner}><Plus className="mr-2 h-4 w-4" />Add Partner</Button>}
      />
      <div className="crm-shell-bg flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <p className="text-[14px] text-[#A1A1AA]">Loading...</p>
          ) : partners.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#D4D4D8] bg-white p-8 text-center text-sm text-[#71717A]">No funding partners yet. Use Add Partner to create one.</div>
          ) : partners.map((partner) => (
            <div
              key={partner.id}
              className="rounded-[12px] border border-[#DDE6F2] bg-white p-4 transition-all hover:border-[#CBD5E1]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-bold text-[#0F172A]">{partner.name}</h3>
                  <p className="text-[12px] font-medium text-[#64748B]">{partner.contact_name || 'No rep'}{partner.phone ? ` · ${partner.phone}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge-${partner.is_active ? 'success' : 'default'}`}>{partner.is_active ? 'Active' : 'Inactive'}</span>
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => openEditPartner(partner)} aria-label={`Edit ${partner.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-2 border-red-200 text-red-700 hover:bg-red-50" onClick={() => deletePartner(partner)} aria-label={`Delete ${partner.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">
                  <div className="text-[10px] font-bold uppercase text-[#64748B]">Min</div>
                  <div className="text-[12px] font-bold text-[#0F172A]">{fmt(partner.min_funding_amount)}</div>
                </div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">
                  <div className="text-[10px] font-bold uppercase text-[#64748B]">Max</div>
                  <div className="text-[12px] font-bold text-[#0F172A]">{fmt(partner.max_funding_amount)}</div>
                </div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">
                  <div className="text-[10px] font-bold uppercase text-[#64748B]">Decision</div>
                  <div className="text-[12px] font-bold text-[#0F172A]">{partner.avg_approval_days ? `${partner.avg_approval_days}d` : '-'}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-1.5 text-xs text-[#475569]">
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Submission: <span className="font-semibold text-[#0F172A]">{partner.submission_email || '-'}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Rep email: <span className="font-semibold text-[#0F172A]">{partner.email || '-'}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Restricted states: <span className="font-semibold text-[#0F172A]">{partner.restricted_states?.length ? partner.restricted_states.join(', ') : 'None listed'}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Restricted industries: <span className="font-semibold text-[#0F172A]">{partner.restricted_industries?.length ? partner.restricted_industries.join(', ') : 'None listed'}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Preferred: <span className="font-semibold text-[#0F172A]">{partner.preferred_industries?.length ? partner.preferred_industries.join(', ') : 'None listed'}</span></div>
              </div>
              {partner.bonus_notes && <p className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 p-2 text-xs font-medium leading-5 text-amber-950">{partner.bonus_notes}</p>}
              {partner.notes && <p className="mt-3 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-2 text-xs leading-5 text-[#475569]">{partner.notes}</p>}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setEditingPartner(null); setForm(emptyPartner); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPartner ? 'Edit Funding Partner' : 'Add Funding Partner'}</DialogTitle>
            <DialogDescription>{editingPartner ? 'Update funder reps, submission routes, and current guidelines.' : 'Create a funder profile for offers and partner reporting.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div><Label>Company Name *</Label><Input data-testid="partner-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div><Label>Name of Rep</Label><Input data-testid="partner-contact-name" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></div>
            <div><Label>Rep Email</Label><Input data-testid="partner-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
            <div><Label>Rep Phone Number</Label><Input data-testid="partner-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
            <div><Label>Submission Email</Label><Input value={form.submission_email} onChange={(event) => setForm({ ...form, submission_email: event.target.value })} /></div>
            <div><Label>Portal URL</Label><Input value={form.portal_url} onChange={(event) => setForm({ ...form, portal_url: event.target.value })} /></div>
            <div><Label>Min Funding</Label><Input type="number" value={form.min_funding_amount} onChange={(event) => setForm({ ...form, min_funding_amount: event.target.value })} /></div>
            <div><Label>Max Funding</Label><Input type="number" value={form.max_funding_amount} onChange={(event) => setForm({ ...form, max_funding_amount: event.target.value })} /></div>
            <div><Label>Min Monthly Revenue</Label><Input type="number" value={form.min_monthly_revenue} onChange={(event) => setForm({ ...form, min_monthly_revenue: event.target.value })} /></div>
            <div><Label>Min Months in Business</Label><Input type="number" value={form.min_time_in_business_months} onChange={(event) => setForm({ ...form, min_time_in_business_months: event.target.value })} /></div>
            <div><Label>Average Decision Days</Label><Input type="number" value={form.avg_approval_days} onChange={(event) => setForm({ ...form, avg_approval_days: event.target.value })} /></div>
            <div><Label>Restricted States</Label><Input placeholder="TX, CA, PR" value={form.restricted_states} onChange={(event) => setForm({ ...form, restricted_states: event.target.value })} /></div>
            <div><Label>States Served</Label><Input placeholder="NY, NJ, FL" value={form.states_served} onChange={(event) => setForm({ ...form, states_served: event.target.value })} /></div>
            <div><Label>Restricted Industries</Label><Input placeholder="Legal, Cannabis, Adult" value={form.restricted_industries} onChange={(event) => setForm({ ...form, restricted_industries: event.target.value })} /></div>
            <div><Label>Preferred Industries</Label><Input placeholder="Construction, Auto sales, Trucking" value={form.preferred_industries} onChange={(event) => setForm({ ...form, preferred_industries: event.target.value })} /></div>
            <div><Label>Product Types</Label><Input value={form.product_types} onChange={(event) => setForm({ ...form, product_types: event.target.value })} /></div>
            <div><Label>Bonus / Commission Notes</Label><Textarea value={form.bonus_notes} onChange={(event) => setForm({ ...form, bonus_notes: event.target.value })} /></div>
            <div className="md:col-span-2"><Label>Lender Guideline Notes</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button><Button data-testid="save-partner" onClick={savePartner} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : editingPartner ? 'Save Changes' : 'Save Partner'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
