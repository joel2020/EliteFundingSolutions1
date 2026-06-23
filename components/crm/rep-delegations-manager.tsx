'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type RecordMap = Record<string, any>;

type Delegation = { id: string; delegate_user_profile_id: string; owner_user_profile_id: string; created_at: string };

type Props = {
  /** Internal team members (id, names, role). */
  users: RecordMap[];
  /** Render a user's display name. */
  displayName: (user: RecordMap | undefined) => string;
};

export function RepDelegationsManager({ users, displayName }: Props) {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [delegate, setDelegate] = useState('');
  const [owner, setOwner] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const usersById = new Map(users.map((u) => [u.id, u]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crm/rep-delegations', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) setDelegations(data.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grant = async () => {
    if (!delegate || !owner) { toast.error('Pick both reps.'); return; }
    if (delegate === owner) { toast.error('A rep cannot be delegated to themselves.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/rep-delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegate_user_profile_id: delegate, owner_user_profile_id: owner }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) { toast.error(data.error || 'Could not grant access.'); return; }
      toast.success('Access granted');
      setDelegate(''); setOwner('');
      load();
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    const res = await fetch(`/api/crm/rep-delegations/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) { toast.error(data.error || 'Could not revoke access.'); return; }
    toast.success('Access revoked');
    load();
  };

  return (
    <div className="rounded-[10px] border border-[#E2E8F0] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#0F172A]">Rep coverage / delegation</h3>
      <p className="mt-1 text-xs text-[#64748B]">Let one rep view and send out another rep&apos;s deals (like a manager). The helper rep sees the other rep&apos;s deals, documents, and can submit them to funders.</p>

      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end">
        <div className="md:w-[260px]">
          <label className="text-xs text-[#64748B]">Give this rep access</label>
          <Select value={delegate || 'none'} onValueChange={(v) => setDelegate(v === 'none' ? '' : v)}>
            <SelectTrigger className="mt-1 h-9 rounded-[7px]"><SelectValue placeholder="Select rep" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Select rep</SelectItem>{users.map((u) => <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:w-[260px]">
          <label className="text-xs text-[#64748B]">To this rep&apos;s deals</label>
          <Select value={owner || 'none'} onValueChange={(v) => setOwner(v === 'none' ? '' : v)}>
            <SelectTrigger className="mt-1 h-9 rounded-[7px]"><SelectValue placeholder="Select rep" /></SelectTrigger>
            <SelectContent><SelectItem value="none">Select rep</SelectItem>{users.map((u) => <SelectItem key={u.id} value={u.id}>{displayName(u)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button className="h-9 rounded-[7px] bg-[#0F2B5B]" onClick={grant} disabled={saving}>{saving ? 'Granting...' : 'Grant access'}</Button>
      </div>

      <div className="mt-4">
        {loading ? <p className="text-xs text-[#64748B]">Loading…</p> : delegations.length === 0 ? (
          <p className="text-xs text-[#64748B]">No coverage grants yet.</p>
        ) : (
          <ul className="grid gap-2">
            {delegations.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-[8px] border border-[#E2E8F0] px-3 py-2 text-sm">
                <span className="text-[#0F172A]"><b>{displayName(usersById.get(d.delegate_user_profile_id))}</b> can access <b>{displayName(usersById.get(d.owner_user_profile_id))}</b>&apos;s deals</span>
                <button type="button" className="shrink-0 text-xs font-semibold text-[#B91C1C] hover:underline" onClick={() => revoke(d.id)}>Revoke</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
