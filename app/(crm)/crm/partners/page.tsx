'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArchiveRestore, Pencil, Plus } from 'lucide-react';
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
import { DeleteConfirmButton } from '@/components/crm/delete-confirm-button';

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
  restricted_industries: '',
  product_types: 'MCA, Revenue based financing',
  required_documents: 'completed_application, bank_statements, drivers_license',
  submission_email: '',
  portal_url: '',
  preferred_submission_method: 'email',
  avg_approval_days: '',
  preferred_industries: '',
  min_credit_score: '',
  max_existing_positions: '',
  max_negative_days: '',
  max_nsf_count: '',
  criteria_notes: '',
  notes: '',
  is_active: 'true',
};

export default function PartnersPage() {
  const { organizationId, loading: crmUserLoading } = useCrmUser();
  const [partners, setPartners] = useState<FundingPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(emptyPartner);
  const [editingPartner, setEditingPartner] = useState<FundingPartner | null>(null);

  const loadPartners = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    let query = supabase
      .from('funding_partners')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name');

    if (!showArchived) query = query.is('deleted_at', null);

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load funding partners');
      console.error(error);
    } else {
      setPartners((data || []) as FundingPartner[]);
    }
    setLoading(false);
  }, [organizationId, showArchived]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) {
      setLoading(false);
      return;
    }
    loadPartners();
  }, [crmUserLoading, organizationId, loadPartners]);

  const formFromPartner = (partner: FundingPartner) => ({
    name: partner.name || '',
    contact_name: partner.contact_name || '',
    email: partner.email || '',
    phone: partner.phone || '',
    min_funding_amount: partner.min_funding_amount ? String(partner.min_funding_amount) : '',
    max_funding_amount: partner.max_funding_amount ? String(partner.max_funding_amount) : '',
    min_monthly_revenue: partner.min_monthly_revenue ? String(partner.min_monthly_revenue) : '',
    min_time_in_business_months: partner.min_time_in_business_months ? String(partner.min_time_in_business_months) : '',
    states_served: partner.states_served?.length ? partner.states_served.join(', ') : '',
    restricted_industries: partner.restricted_industries?.length ? partner.restricted_industries.join(', ') : '',
    product_types: partner.product_types?.length ? partner.product_types.join(', ') : '',
    required_documents: Array.isArray((partner as any).required_documents) && (partner as any).required_documents.length ? (partner as any).required_documents.join(', ') : '',
    submission_email: partner.submission_email || '',
    portal_url: partner.portal_url || '',
    preferred_submission_method: (partner as any).preferred_submission_method || 'email',
    avg_approval_days: partner.avg_approval_days ? String(partner.avg_approval_days) : '',
    preferred_industries: Array.isArray((partner as any).preferred_industries) && (partner as any).preferred_industries.length ? (partner as any).preferred_industries.join(', ') : '',
    min_credit_score: (partner as any).min_credit_score ? String((partner as any).min_credit_score) : '',
    max_existing_positions: (partner as any).max_existing_positions ? String((partner as any).max_existing_positions) : '',
    max_negative_days: (partner as any).max_negative_days ? String((partner as any).max_negative_days) : '',
    max_nsf_count: (partner as any).max_nsf_count ? String((partner as any).max_nsf_count) : '',
    criteria_notes: (partner as any).criteria_notes || '',
    notes: partner.notes || '',
    is_active: partner.is_active === false ? 'false' : 'true',
  });

  const openAddPartner = () => {
    setEditingPartner(null);
    setForm(emptyPartner);
    setShowDialog(true);
  };

  const openEditPartner = (partner: FundingPartner) => {
    setEditingPartner(partner);
    setForm(formFromPartner(partner));
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingPartner(null);
    setForm(emptyPartner);
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
        min_credit_score: form.min_credit_score || null,
        max_existing_positions: form.max_existing_positions || null,
        max_negative_days: form.max_negative_days || null,
        max_nsf_count: form.max_nsf_count || null,
        avg_approval_days: form.avg_approval_days || null,
        is_active: form.is_active !== 'false',
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      toast.error(result.error || (editingPartner ? 'Failed to update funding partner' : 'Failed to add funding partner'));
    } else {
      toast.success(editingPartner ? 'Funding partner updated' : 'Funding partner added');
      closeDialog();
      if (organizationId) loadPartners();
    }
    setSaving(false);
  };

  const restorePartner = async (partner: FundingPartner) => {
    setRestoringId(partner.id);
    try {
      const response = await fetch(`/api/crm/partners/${partner.id}/restore`, { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        toast.error(result.error || 'Unable to restore funding partner');
      } else {
        toast.success(`${partner.name} restored`);
        await loadPartners();
      }
    } catch {
      toast.error('Network error while restoring funding partner');
    } finally {
      setRestoringId(null);
    }
  };

  const fmt = (n: number | null) => (n ? `$${(n / 1000).toFixed(0)}K` : '-');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar
        title="Funding Partners"
        subtitle="Manage your funder network, requirements, and submission rules"
        actions={(
          <div className="flex items-center gap-2">
            <Button data-testid="toggle-archived-partners" variant="outline" className="h-9 rounded-[8px]" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </Button>
            <Button data-testid="add-partner" className="h-9 rounded-[8px] bg-[#2563EB]" onClick={openAddPartner}><Plus className="mr-2 h-4 w-4" />Add Partner</Button>
          </div>
        )}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {loading ? (
            <p className="text-[14px] text-[#A1A1AA]">Loading...</p>
          ) : partners.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#D4D4D8] bg-white p-8 text-center text-sm text-[#71717A]">No funding partners yet. Use Add Partner to create one.</div>
          ) : partners.map((partner) => (
            <div
              key={partner.id}
              data-testid={`partner-card-${partner.id}`}
              className="rounded-[16px] border border-[#E4E4E7] bg-white p-5 transition-all hover:border-[#D4D4D8]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#09090B]">{partner.name}</h3>
                  <p className="text-[13px] text-[#71717A]">{partner.contact_name ?? '-'}</p>
                </div>
                <span className={`badge-${partner.deleted_at ? 'default' : partner.is_active ? 'success' : 'default'}`}>
                  {partner.deleted_at ? 'Archived' : partner.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-[8px] bg-[#F4F4F5] p-2">
                  <div className="text-[11px] text-[#A1A1AA]">Min Funding</div>
                  <div className="text-[13px] font-semibold text-[#09090B]">{fmt(partner.min_funding_amount)}</div>
                </div>
                <div className="rounded-[8px] bg-[#F4F4F5] p-2">
                  <div className="text-[11px] text-[#A1A1AA]">Max Funding</div>
                  <div className="text-[13px] font-semibold text-[#09090B]">{fmt(partner.max_funding_amount)}</div>
                </div>
                <div className="rounded-[8px] bg-[#F4F4F5] p-2">
                  <div className="text-[11px] text-[#A1A1AA]">Avg Decision</div>
                  <div className="text-[13px] font-semibold text-[#09090B]">{partner.avg_approval_days ? `${partner.avg_approval_days}d` : '-'}</div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-[#475569]">
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Revenue min: <span className="font-semibold text-[#0F172A]">{fmt(partner.min_monthly_revenue)}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Credit min: <span className="font-semibold text-[#0F172A]">{(partner as any).min_credit_score || 'Not set'}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Preferred industries: <span className="font-semibold text-[#0F172A]">{Array.isArray((partner as any).preferred_industries) && (partner as any).preferred_industries.length ? (partner as any).preferred_industries.join(', ') : 'Any eligible industry'}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">States: <span className="font-semibold text-[#0F172A]">{partner.states_served?.length ? partner.states_served.join(', ') : 'All states'}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Restricted: <span className="font-semibold text-[#0F172A]">{partner.restricted_industries?.length ? partner.restricted_industries.join(', ') : 'None listed'}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Required docs: <span className="font-semibold text-[#0F172A]">{Array.isArray((partner as any).required_documents) && (partner as any).required_documents.length ? (partner as any).required_documents.join(', ') : 'Default package'}</span></div>
              </div>
              {partner.email && (
                <a href={`mailto:${partner.email}`} className="mt-3 block text-[12px] text-[#2563EB] hover:underline">
                  {partner.email}
                </a>
              )}
              <div className="mt-4 border-t pt-4">
                {partner.deleted_at ? (
                  <Button
                    data-testid={`restore-partner-${partner.id}`}
                    variant="outline"
                    className="h-9 w-full rounded-[7px] border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => restorePartner(partner)}
                    disabled={restoringId === partner.id}
                  >
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                    {restoringId === partner.id ? 'Restoring...' : 'Restore Funder'}
                  </Button>
                ) : (
                  <>
                    <Button data-testid={`edit-partner-${partner.id}`} variant="outline" className="mb-2 h-9 w-full rounded-[7px]" onClick={() => openEditPartner(partner)}><Pencil className="mr-2 h-4 w-4" />Edit Funder Rules</Button>
                    <DeleteConfirmButton
                      itemLabel={`funder ${partner.name}`}
                      endpoint={`/api/crm/partners/${partner.id}`}
                      onDeleted={loadPartners}
                    />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={(open) => { if (open) setShowDialog(true); else closeDialog(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPartner ? 'Edit Funding Partner' : 'Add Funding Partner'}</DialogTitle>
            <DialogDescription>{editingPartner ? 'Update funder contact information, submission route, criteria, and notes.' : 'Create a funder profile for offers and partner reporting.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div><Label>Company Name *</Label><Input data-testid="partner-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div><Label>Contact Name</Label><Input data-testid="partner-contact-name" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></div>
            <div><Label>Email</Label><Input data-testid="partner-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
            <div><Label>Phone Number</Label><Input data-testid="partner-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
            <div><Label>Submission Email</Label><Input value={form.submission_email} onChange={(event) => setForm({ ...form, submission_email: event.target.value })} /></div>
            <div><Label>Portal URL</Label><Input value={form.portal_url} onChange={(event) => setForm({ ...form, portal_url: event.target.value })} /></div>
            <div><Label>Preferred Submission Method</Label><select className="mt-1 h-10 w-full rounded-[7px] border border-input bg-background px-3 text-sm" value={form.preferred_submission_method} onChange={(event) => setForm({ ...form, preferred_submission_method: event.target.value })}><option value="email">Email</option><option value="portal">Portal</option><option value="api">API</option><option value="manual">Manual</option></select></div>
            <div><Label>Preferred Industries</Label><Input data-testid="partner-preferred-industries" placeholder="Retail, restaurant, construction" value={form.preferred_industries} onChange={(event) => setForm({ ...form, preferred_industries: event.target.value })} /></div>
            <div><Label>Min Funding</Label><Input type="number" value={form.min_funding_amount} onChange={(event) => setForm({ ...form, min_funding_amount: event.target.value })} /></div>
            <div><Label>Max Funding</Label><Input type="number" value={form.max_funding_amount} onChange={(event) => setForm({ ...form, max_funding_amount: event.target.value })} /></div>
            <div><Label>Min Monthly Revenue</Label><Input type="number" value={form.min_monthly_revenue} onChange={(event) => setForm({ ...form, min_monthly_revenue: event.target.value })} /></div>
            <div><Label>Min Months in Business</Label><Input type="number" value={form.min_time_in_business_months} onChange={(event) => setForm({ ...form, min_time_in_business_months: event.target.value })} /></div>
            <div><Label>Min Credit / FICO</Label><Input data-testid="partner-min-credit-score" type="number" min="300" max="850" value={form.min_credit_score} onChange={(event) => setForm({ ...form, min_credit_score: event.target.value })} /></div>
            <div><Label>Max Existing Positions</Label><Input type="number" value={form.max_existing_positions} onChange={(event) => setForm({ ...form, max_existing_positions: event.target.value })} /></div>
            <div><Label>Max Negative Days</Label><Input type="number" value={form.max_negative_days} onChange={(event) => setForm({ ...form, max_negative_days: event.target.value })} /></div>
            <div><Label>Max NSF Count</Label><Input type="number" value={form.max_nsf_count} onChange={(event) => setForm({ ...form, max_nsf_count: event.target.value })} /></div>
            <div><Label>Average Decision Days</Label><Input type="number" value={form.avg_approval_days} onChange={(event) => setForm({ ...form, avg_approval_days: event.target.value })} /></div>
            <div><Label>Status</Label><select data-testid="partner-status" className="mt-1 h-10 w-full rounded-[7px] border border-input bg-background px-3 text-sm" value={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.value })}><option value="true">Active</option><option value="false">Inactive</option></select></div>
            <div><Label>States Served</Label><Input placeholder="NY, NJ, FL" value={form.states_served} onChange={(event) => setForm({ ...form, states_served: event.target.value })} /></div>
            <div><Label>Product Types</Label><Input value={form.product_types} onChange={(event) => setForm({ ...form, product_types: event.target.value })} /></div>
            <div><Label>Restricted Industries</Label><Input placeholder="Cannabis, gambling" value={form.restricted_industries} onChange={(event) => setForm({ ...form, restricted_industries: event.target.value })} /></div>
            <div className="md:col-span-2"><Label>Required Documents</Label><Input data-testid="partner-required-documents" placeholder="completed_application, bank_statements, drivers_license, voided_check" value={form.required_documents} onChange={(event) => setForm({ ...form, required_documents: event.target.value })} /></div>
            <div className="md:col-span-2"><Label>Criteria Notes</Label><Textarea data-testid="partner-criteria-notes" value={form.criteria_notes} onChange={(event) => setForm({ ...form, criteria_notes: event.target.value })} /></div>
            <div className="md:col-span-2"><Label>Notes / Rules</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={closeDialog}>Cancel</Button><Button data-testid="save-partner" onClick={savePartner} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : editingPartner ? 'Update Partner' : 'Save Partner'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
