'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CrmTopbar } from '@/components/crm/topbar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCrmUser } from '@/lib/crm-auth';
import { supabase } from '@/lib/supabase';
import type { FundingPartner } from '@/types/database';

const emptyPartner = {
  name: '',
  contact_name: '',
  email: '',
  min_funding_amount: '',
  max_funding_amount: '',
  avg_approval_days: '',
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
    if (!organizationId || !form.name.trim()) {
      toast.error('Partner name is required');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('funding_partners').insert({
      organization_id: organizationId,
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      email: form.email.trim() || null,
      min_funding_amount: form.min_funding_amount ? Number(form.min_funding_amount) : null,
      max_funding_amount: form.max_funding_amount ? Number(form.max_funding_amount) : null,
      avg_approval_days: form.avg_approval_days ? Number(form.avg_approval_days) : null,
      is_active: true,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Funding partner added');
      setShowDialog(false);
      setForm(emptyPartner);
      loadPartners();
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Funding Partner</DialogTitle>
            <DialogDescription>Create a funder profile for offers and partner reporting.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div><Label>Name *</Label><Input data-testid="partner-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div><Label>Contact Name</Label><Input data-testid="partner-contact-name" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></div>
            <div className="md:col-span-2"><Label>Email</Label><Input data-testid="partner-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
            <div><Label>Min Funding</Label><Input type="number" value={form.min_funding_amount} onChange={(event) => setForm({ ...form, min_funding_amount: event.target.value })} /></div>
            <div><Label>Max Funding</Label><Input type="number" value={form.max_funding_amount} onChange={(event) => setForm({ ...form, max_funding_amount: event.target.value })} /></div>
            <div><Label>Average Decision Days</Label><Input type="number" value={form.avg_approval_days} onChange={(event) => setForm({ ...form, avg_approval_days: event.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button><Button data-testid="save-partner" onClick={savePartner} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : 'Save Partner'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
