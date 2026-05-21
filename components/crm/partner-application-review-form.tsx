'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { buildPartnerApplicationPayload } from '@/lib/partner-application-fields';

type RecordMap = Record<string, any>;

type PartnerApplicationReviewFormProps = {
  partnerApplication: RecordMap;
  onCancel: () => void;
  onSave: (payload: RecordMap, notes: string, regenerate: boolean) => Promise<void>;
};

const fieldGroups = [
  {
    title: 'Business',
    fields: [
      ['Company legal name', 'legal_name'],
      ['DBA', 'dba'],
      ['Business address', 'address'],
      ['City', 'city'],
      ['State', 'state'],
      ['ZIP', 'zip'],
      ['Business phone', 'business_phone'],
      ['Business email', 'business_email'],
      ['Tax ID / EIN', 'ein'],
      ['Business start date', 'start_date'],
      ['Requested amount', 'requested_amount'],
      ['Industry / products', 'products_services'],
    ],
  },
  {
    title: 'Primary owner',
    fields: [
      ['First name', 'owner1.first_name'],
      ['Last name', 'owner1.last_name'],
      ['Home address', 'owner1.address'],
      ['City', 'owner1.city'],
      ['State', 'owner1.state'],
      ['ZIP', 'owner1.zip'],
      ['Cell phone', 'owner1.phone'],
      ['Email', 'owner1.email'],
      ['Ownership %', 'owner1.ownership_percentage'],
      ['Date of birth', 'owner1.dob'],
      ['SSN', 'owner1.ssn'],
    ],
  },
] as const;

function getPath(row: RecordMap, path: string) {
  return path.split('.').reduce<any>((value, key) => value?.[key], row) ?? '';
}

function setPath(row: RecordMap, path: string, value: string) {
  const keys = path.split('.');
  const next = { ...row };
  let cursor = next;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
  cursor[keys[keys.length - 1]] = value;
  return buildPartnerApplicationPayload(next);
}

export function PartnerApplicationReviewForm({ partnerApplication, onCancel, onSave }: PartnerApplicationReviewFormProps) {
  const [payload, setPayload] = useState<RecordMap>(() => buildPartnerApplicationPayload(partnerApplication.edited_payload || partnerApplication.extracted_payload || {}));
  const [notes, setNotes] = useState(partnerApplication.notes || '');
  const [saving, setSaving] = useState<'save' | 'regenerate' | null>(null);

  useEffect(() => {
    setPayload(buildPartnerApplicationPayload(partnerApplication.edited_payload || partnerApplication.extracted_payload || {}));
    setNotes(partnerApplication.notes || '');
  }, [partnerApplication]);

  const save = async (regenerate: boolean) => {
    setSaving(regenerate ? 'regenerate' : 'save');
    try {
      await onSave(buildPartnerApplicationPayload(payload), notes, regenerate);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#334155]">
        <p className="font-semibold text-[#0F172A]">{partnerApplication.original_file_name || 'Partner application'}</p>
        <p className="mt-1 text-xs text-[#64748B]">Review the fields below, save changes, then regenerate the Elite application when needed. Sensitive values stay masked unless you enter a replacement.</p>
      </div>
      {fieldGroups.map((group) => (
        <section key={group.title} className="grid gap-3">
          <h3 className="text-sm font-semibold text-[#0F172A]">{group.title}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {group.fields.map(([label, key]) => (
              <div key={key}>
                <Label className="text-xs text-[#64748B]">{label}</Label>
                <Input
                  aria-label={label}
                  value={getPath(payload, key)}
                  onChange={(event) => setPayload((current) => setPath(current, key, event.target.value))}
                  className="mt-1 rounded-[7px]"
                  placeholder={key.includes('ssn') || key.includes('ein') || key.includes('dob') ? 'Masked or not provided' : undefined}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
      <div>
        <Label className="text-xs text-[#64748B]">Review notes</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-[96px] rounded-[7px]" />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant="outline" onClick={() => save(false)} disabled={!!saving}>{saving === 'save' ? 'Saving...' : 'Save Review'}</Button>
        <Button className="bg-[#0F2B5B]" onClick={() => save(true)} disabled={!!saving}>{saving === 'regenerate' ? 'Regenerating...' : 'Save & Regenerate Elite Application'}</Button>
      </div>
    </div>
  );
}
