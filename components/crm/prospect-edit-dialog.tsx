'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type RecordMap = Record<string, any>;

type AdvanceSeed = { funder_name: string; current_balance: string; original_amount: string; daily_payment: string };

type OwnerSeed = {
  id?: string;
  isReal: boolean;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ownership_percentage: string;
  credit_score_range: string;
  ssn: string;
  dob: string;
};

type ProspectEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: RecordMap;
  business: RecordMap | null | undefined;
  ein: string;
  owners: OwnerSeed[];
  applicationId?: string | null;
  useOfFunds?: string;
  advances?: AdvanceSeed[];
  onSaved: () => void;
};

function emptyAdvance(): AdvanceSeed {
  return { funder_name: '', current_balance: '', original_amount: '', daily_payment: '' };
}

const CREDIT_RANGES = ['', '720+', '680-719', '640-679', '600-639', '<600'];

const sanitizeNumber = (value: string) => {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  return cleaned === '' ? null : Number(cleaned);
};

function emptyOwner(): OwnerSeed {
  return { isReal: false, first_name: '', last_name: '', email: '', phone: '', address: '', city: '', state: '', zip: '', ownership_percentage: '', credit_score_range: '', ssn: '', dob: '' };
}

function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <Label className="text-xs text-[#64748B]">{label}</Label>
      <Input value={value} type={type} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 rounded-[7px]" />
    </div>
  );
}

export function ProspectEditDialog({ open, onOpenChange, deal, business, ein, owners, applicationId, useOfFunds, advances, onSaved }: ProspectEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [biz, setBiz] = useState<RecordMap>({});
  const [dealForm, setDealForm] = useState<RecordMap>({});
  const [ownerForms, setOwnerForms] = useState<OwnerSeed[]>([]);
  const [useOfFundsForm, setUseOfFundsForm] = useState('');
  const [advanceForms, setAdvanceForms] = useState<AdvanceSeed[]>([]);

  useEffect(() => {
    if (!open) return;
    setBiz({
      legal_name: business?.legal_name || '',
      dba: business?.dba || '',
      industry: business?.industry || '',
      start_date: business?.start_date || '',
      phone: business?.phone || '',
      email: business?.email || '',
      website: business?.website || '',
      address: business?.address || '',
      city: business?.city || '',
      state: business?.state || '',
      zip: business?.zip || '',
      monthly_gross_revenue: business?.monthly_gross_revenue != null ? String(business.monthly_gross_revenue) : '',
      ein: ein || '',
    });
    setDealForm({
      requested_amount: deal?.requested_amount != null ? String(deal.requested_amount) : '',
      contact_name: deal?.contact_name || '',
      contact_email: deal?.contact_email || '',
      contact_phone: deal?.contact_phone || '',
    });
    setOwnerForms(owners.length ? owners.map((o) => ({ ...o })) : []);
    setUseOfFundsForm(useOfFunds || '');
    setAdvanceForms((advances || []).map((a) => ({ ...a })));
    // Initialize from the current records only when the dialog opens, so parent
    // re-renders (e.g. background data refreshes) don't wipe in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateAdvance = (index: number, key: keyof AdvanceSeed, value: string) => {
    setAdvanceForms((prev) => prev.map((a, i) => (i === index ? { ...a, [key]: value } : a)));
  };

  const updateOwner = (index: number, key: keyof OwnerSeed, value: string) => {
    setOwnerForms((prev) => prev.map((o, i) => (i === index ? { ...o, [key]: value } : o)));
  };

  const save = async () => {
    if (!biz.legal_name?.trim()) { toast.error('Legal business name is required.'); return; }
    setSaving(true);
    try {
      const calls: Promise<Response>[] = [];

      if (business?.id) {
        calls.push(fetch(`/api/crm/businesses/${business.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            legal_name: biz.legal_name.trim(),
            dba: biz.dba || null,
            industry: biz.industry || null,
            start_date: biz.start_date || null,
            phone: biz.phone || null,
            email: biz.email || '',
            website: biz.website || null,
            address: biz.address || null,
            city: biz.city || null,
            state: biz.state || null,
            zip: biz.zip || null,
            monthly_gross_revenue: sanitizeNumber(biz.monthly_gross_revenue),
            ein: biz.ein || null,
          }),
        }));
      }

      calls.push(fetch(`/api/crm/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_amount: sanitizeNumber(dealForm.requested_amount),
          contact_name: dealForm.contact_name || null,
          contact_email: dealForm.contact_email || '',
          contact_phone: dealForm.contact_phone || null,
        }),
      }));

      ownerForms.forEach((owner, index) => {
        if (!owner.first_name?.trim() && !owner.last_name?.trim()) return;
        const body = {
          first_name: owner.first_name || null,
          last_name: owner.last_name || null,
          email: owner.email || '',
          phone: owner.phone || null,
          address: owner.address || null,
          city: owner.city || null,
          state: owner.state || null,
          zip: owner.zip || null,
          ownership_percentage: owner.ownership_percentage === '' ? null : sanitizeNumber(owner.ownership_percentage),
          credit_score_range: owner.credit_score_range || '',
          ssn: owner.ssn || null,
          dob: owner.dob || null,
          is_primary: index === 0,
        };
        if (owner.isReal && owner.id) {
          calls.push(fetch(`/api/crm/owners/${owner.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
        } else {
          calls.push(fetch(`/api/crm/deals/${deal.id}/owners`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
        }
      });

      if (applicationId) {
        const cleanedAdvances = advanceForms
          .map((a) => ({ funder_name: a.funder_name.trim(), current_balance: a.current_balance.trim(), original_amount: a.original_amount.trim(), daily_payment: a.daily_payment.trim() }))
          .filter((a) => a.funder_name || a.current_balance || a.original_amount || a.daily_payment);
        calls.push(fetch(`/api/crm/applications/${applicationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            use_of_funds: useOfFundsForm || null,
            has_existing_advances: cleanedAdvances.length > 0,
            existing_advances: cleanedAdvances,
          }),
        }));
      }

      const responses = await Promise.all(calls);
      const failed = responses.filter((r) => !r.ok).length;
      if (failed > 0) {
        toast.error(`Saved with ${failed} error${failed === 1 ? '' : 's'}. Some fields may not have updated.`);
      } else {
        toast.success('Prospect information updated');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error('Could not save prospect information.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-[8px]">
        <DialogHeader><DialogTitle>Edit prospect information</DialogTitle></DialogHeader>
        <div className="grid gap-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Business</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Legal business name" value={biz.legal_name || ''} onChange={(v) => setBiz({ ...biz, legal_name: v })} />
              <Field label="DBA" value={biz.dba || ''} onChange={(v) => setBiz({ ...biz, dba: v })} />
              <Field label="Industry" value={biz.industry || ''} onChange={(v) => setBiz({ ...biz, industry: v })} />
              <Field label="Business start date" value={biz.start_date || ''} onChange={(v) => setBiz({ ...biz, start_date: v })} placeholder="YYYY-MM-DD" />
              <Field label="Business phone" value={biz.phone || ''} onChange={(v) => setBiz({ ...biz, phone: v })} />
              <Field label="Business email" value={biz.email || ''} onChange={(v) => setBiz({ ...biz, email: v })} />
              <Field label="Website" value={biz.website || ''} onChange={(v) => setBiz({ ...biz, website: v })} />
              <Field label="EIN / Tax ID" value={biz.ein || ''} onChange={(v) => setBiz({ ...biz, ein: v })} placeholder="9-digit Tax ID" />
              <Field label="Street address" value={biz.address || ''} onChange={(v) => setBiz({ ...biz, address: v })} />
              <Field label="City" value={biz.city || ''} onChange={(v) => setBiz({ ...biz, city: v })} />
              <Field label="State" value={biz.state || ''} onChange={(v) => setBiz({ ...biz, state: v })} />
              <Field label="ZIP" value={biz.zip || ''} onChange={(v) => setBiz({ ...biz, zip: v })} />
              <Field label="Average monthly revenue" value={biz.monthly_gross_revenue || ''} onChange={(v) => setBiz({ ...biz, monthly_gross_revenue: v })} placeholder="$" />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Funding request &amp; contact</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Requested amount" value={dealForm.requested_amount || ''} onChange={(v) => setDealForm({ ...dealForm, requested_amount: v })} placeholder="$" />
              <Field label="Contact name" value={dealForm.contact_name || ''} onChange={(v) => setDealForm({ ...dealForm, contact_name: v })} />
              <Field label="Contact email" value={dealForm.contact_email || ''} onChange={(v) => setDealForm({ ...dealForm, contact_email: v })} />
              <Field label="Contact phone" value={dealForm.contact_phone || ''} onChange={(v) => setDealForm({ ...dealForm, contact_phone: v })} />
            </div>
          </section>

          {applicationId && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Funding details</h3>
              <div className="grid gap-3">
                <div>
                  <Label className="text-xs text-[#64748B]">Use of funds</Label>
                  <Textarea value={useOfFundsForm} onChange={(e) => setUseOfFundsForm(e.target.value)} className="mt-1 min-h-[72px] rounded-[7px]" placeholder="What the funding will be used for" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-[#64748B]">Existing advances / loans</Label>
                  <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setAdvanceForms((prev) => [...prev, emptyAdvance()])}>Add advance</Button>
                </div>
                {advanceForms.length === 0 && <p className="text-sm text-[#64748B]">No open advances on file.</p>}
                {advanceForms.map((advance, index) => (
                  <div key={index} className="rounded-[8px] border border-[#E2E8F0] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase text-[#64748B]">Advance {index + 1}</p>
                      <button type="button" className="text-xs text-[#B91C1C] hover:underline" onClick={() => setAdvanceForms((prev) => prev.filter((_, i) => i !== index))}>Remove</button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Funder / lender" value={advance.funder_name} onChange={(v) => updateAdvance(index, 'funder_name', v)} />
                      <Field label="Current balance" value={advance.current_balance} onChange={(v) => updateAdvance(index, 'current_balance', v)} placeholder="$" />
                      <Field label="Original funded amount" value={advance.original_amount} onChange={(v) => updateAdvance(index, 'original_amount', v)} placeholder="$" />
                      <Field label="Daily / weekly payment" value={advance.daily_payment} onChange={(v) => updateAdvance(index, 'daily_payment', v)} placeholder="$" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0F172A]">Owners</h3>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setOwnerForms((prev) => [...prev, emptyOwner()])}>Add owner</Button>
            </div>
            <div className="grid gap-4">
              {ownerForms.length === 0 && <p className="text-sm text-[#64748B]">No owner on file. Click &ldquo;Add owner&rdquo; to add one.</p>}
              {ownerForms.map((owner, index) => (
                <div key={owner.id || `new-${index}`} className="rounded-[8px] border border-[#E2E8F0] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-[#64748B]">{index === 0 ? 'Primary owner' : `Owner ${index + 1}`}</p>
                    <button type="button" className="text-xs text-[#B91C1C] hover:underline" onClick={() => setOwnerForms((prev) => prev.filter((_, i) => i !== index))}>Remove</button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="First name" value={owner.first_name} onChange={(v) => updateOwner(index, 'first_name', v)} />
                    <Field label="Last name" value={owner.last_name} onChange={(v) => updateOwner(index, 'last_name', v)} />
                    <Field label="Cell phone" value={owner.phone} onChange={(v) => updateOwner(index, 'phone', v)} />
                    <Field label="Email" value={owner.email} onChange={(v) => updateOwner(index, 'email', v)} />
                    <Field label="Home address" value={owner.address} onChange={(v) => updateOwner(index, 'address', v)} />
                    <Field label="City" value={owner.city} onChange={(v) => updateOwner(index, 'city', v)} />
                    <Field label="State" value={owner.state} onChange={(v) => updateOwner(index, 'state', v)} />
                    <Field label="ZIP" value={owner.zip} onChange={(v) => updateOwner(index, 'zip', v)} />
                    <Field label="Ownership %" value={owner.ownership_percentage} onChange={(v) => updateOwner(index, 'ownership_percentage', v)} />
                    <div>
                      <Label className="text-xs text-[#64748B]">Estimated credit score</Label>
                      <Select value={owner.credit_score_range || 'none'} onValueChange={(v) => updateOwner(index, 'credit_score_range', v === 'none' ? '' : v)}>
                        <SelectTrigger className="mt-1 rounded-[7px]"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent><SelectItem value="none">Not set</SelectItem>{CREDIT_RANGES.filter(Boolean).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Field label="SSN" value={owner.ssn} onChange={(v) => updateOwner(index, 'ssn', v)} placeholder="9-digit SSN" />
                    <Field label="Date of birth" value={owner.dob} onChange={(v) => updateOwner(index, 'dob', v)} placeholder="YYYY-MM-DD" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button data-testid="save-prospect-edit" onClick={save} disabled={saving} className="bg-[#0F2B5B]">{saving ? 'Saving...' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
