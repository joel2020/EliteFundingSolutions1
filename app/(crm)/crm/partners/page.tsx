'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
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
  restricted_industries: '',
  product_types: 'MCA, Revenue based financing',
  submission_email: '',
  portal_url: '',
  avg_approval_days: '',
  notes: '',
};

export default function PartnersPage() {
  const { organizationId, loading: crmUserLoading } = useCrmUser();
  const [partners, setPartners] = useState<FundingPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyPartner);

  const loadPartners = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('funding_partners')
      .select('*')
      .eq('organization_id', organizationId)
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
    const response = await fetch('/api/crm/partners', {
      method: 'POST',
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
      toast.error(result.error || 'Failed to add funding partner');
    } else {
      toast.success('Funding partner added');
      setShowDialog(false);
      setForm(emptyPartner);
      if (organizationId) loadPartners();
    }
    setSaving(false);
  };

  const fmt = (n: number | null) => (n ? `$${(n / 1000).toFixed(0)}K` : '-');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar
        title="Funding Partners"
        subtitle="Manage your lender and funder network"
        actions={<Button data-testid="add-partner" className="h-9 rounded-[8px] bg-[#2563EB]" onClick={() => setShowDialog(true)}><Plus className="mr-2 h-4 w-4" />Add Partner</Button>}
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
              className="rounded-[16px] border border-[#E4E4E7] bg-white p-5 transition-all hover:border-[#D4D4D8]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#09090B]">{partner.name}</h3>
                  <p className="text-[13px] text-[#71717A]">{partner.contact_name ?? '-'}</p>
                </div>
                <span className={`badge-${partner.is_active ? 'success' : 'default'}`}>
                  {partner.is_active ? 'Active' : 'Inactive'}
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
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">States: <span className="font-semibold text-[#0F172A]">{partner.states_served?.length ? partner.states_served.join(', ') : 'All states'}</span></div>
                <div className="rounded-[8px] bg-[#F8FAFC] p-2">Restricted: <span className="font-semibold text-[#0F172A]">{partner.restricted_industries?.length ? partner.restricted_industries.join(', ') : 'None listed'}</span></div>
              </div>
              {partner.email && (
                <a href={`mailto:${partner.email}`} className="mt-3 block text-[12px] text-[#2563EB] hover:underline">
                  {partner.email}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Funding Partner</DialogTitle>
            <DialogDescription>Create a funder profile for offers and partner reporting.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div><Label>Company Name *</Label><Input data-testid="partner-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div><Label>Contact Name</Label><Input data-testid="partner-contact-name" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></div>
            <div><Label>Email</Label><Input data-testid="partner-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
            <div><Label>Phone Number</Label><Input data-testid="partner-phone" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
            <div><Label>Submission Email</Label><Input value={form.submission_email} onChange={(event) => setForm({ ...form, submission_email: event.target.value })} /></div>
            <div><Label>Portal URL</Label><Input value={form.portal_url} onChange={(event) => setForm({ ...form, portal_url: event.target.value })} /></div>
            <div><Label>Min Funding</Label><Input type="number" value={form.min_funding_amount} onChange={(event) => setForm({ ...form, min_funding_amount: event.target.value })} /></div>
            <div><Label>Max Funding</Label><Input type="number" value={form.max_funding_amount} onChange={(event) => setForm({ ...form, max_funding_amount: event.target.value })} /></div>
            <div><Label>Min Monthly Revenue</Label><Input type="number" value={form.min_monthly_revenue} onChange={(event) => setForm({ ...form, min_monthly_revenue: event.target.value })} /></div>
            <div><Label>Min Months in Business</Label><Input type="number" value={form.min_time_in_business_months} onChange={(event) => setForm({ ...form, min_time_in_business_months: event.target.value })} /></div>
            <div><Label>Average Decision Days</Label><Input type="number" value={form.avg_approval_days} onChange={(event) => setForm({ ...form, avg_approval_days: event.target.value })} /></div>
            <div><Label>States Served</Label><Input placeholder="NY, NJ, FL" value={form.states_served} onChange={(event) => setForm({ ...form, states_served: event.target.value })} /></div>
            <div><Label>Product Types</Label><Input value={form.product_types} onChange={(event) => setForm({ ...form, product_types: event.target.value })} /></div>
            <div><Label>Restricted Industries</Label><Input placeholder="Cannabis, gambling" value={form.restricted_industries} onChange={(event) => setForm({ ...form, restricted_industries: event.target.value })} /></div>
            <div className="md:col-span-2"><Label>Criteria Notes</Label><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button><Button data-testid="save-partner" onClick={savePartner} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : 'Save Partner'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
