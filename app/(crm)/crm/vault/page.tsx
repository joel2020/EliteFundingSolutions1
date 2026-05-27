'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CrmTopbar } from '@/components/crm/topbar';
import { useCrmDataset } from '@/components/crm/crm-platform';

const vaultStages = new Set(['declined', 'lost_unresponsive', 'withdrawn', 'closed_not_funded', 'not_funded']);

function date(value: any) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set';
}

function name(row: any) {
  return row.businesses?.dba || row.businesses?.legal_name || row.title || 'Unnamed merchant';
}

export default function VaultPage() {
  const { deals, notes, partnerSubmissions, loading, reload } = useCrmDataset();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const rows = useMemo(() => deals.filter((deal: any) => vaultStages.has(deal.stage_slug) || deal.closed_not_funded_at || deal.declined_at), [deals]);
  const filtered = rows.filter((deal: any) => {
    const submissions = partnerSubmissions.filter((row: any) => row.deal_id === deal.id);
    const haystack = [name(deal), deal.stage_slug, deal.notes, submissions.map((row: any) => row.decline_reason || row.notes).join(' ')].join(' ').toLowerCase();
    return haystack.includes(search.toLowerCase()) && (status === 'all' || deal.stage_slug === status);
  });
  const addNote = async (dealId: string) => {
    const body = window.prompt('Vault note');
    if (!body?.trim()) return;
    const response = await fetch(`/api/crm/deals/${dealId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, is_internal: true }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) toast.error(result.error || 'Unable to save note');
    else { toast.success('Vault note saved'); reload(); }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar title="The Vault" subtitle={loading ? 'Loading non-funded deals...' : `${filtered.length} non-funded deals`} />
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-[#64748B]" /><Input className="h-10 rounded-[7px] pl-9" placeholder="Search declined, withdrawn, incomplete, or revisit deals" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-10 rounded-[7px] md:w-[220px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Array.from(new Set(rows.map((deal: any) => deal.stage_slug).filter(Boolean))).map((item) => <SelectItem key={item} value={item}>{item.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="grid gap-3">
          {filtered.map((deal: any) => {
            const submissions = partnerSubmissions.filter((row: any) => row.deal_id === deal.id);
            const lastNote = notes.find((row: any) => row.deal_id === deal.id);
            const reason = submissions.find((row: any) => row.decline_reason)?.decline_reason || deal.decline_reason || deal.close_reason || deal.notes || 'Reason not recorded yet';
            return <div key={deal.id} className="rounded-[8px] border border-[#E2E8F0] bg-white p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><Link href={`/crm/deals/${deal.id}`} className="text-base font-semibold text-[#0F2B5B]">{name(deal)}</Link><p className="mt-1 text-sm text-[#334155]">{reason}</p><p className="mt-2 text-xs text-[#64748B]">Status: {deal.stage_slug?.replaceAll('_', ' ') || 'not funded'} | Last activity: {date(deal.updated_at || deal.created_at)}</p>{lastNote && <p className="mt-2 text-xs text-[#64748B]">Latest note: {lastNote.body || lastNote.note}</p>}</div><Button variant="outline" className="h-9 rounded-[7px]" onClick={() => addNote(deal.id)}>Add note</Button></div></div>;
          })}
          {!loading && filtered.length === 0 && <div className="rounded-[8px] border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">No Vault deals match this filter.</div>}
        </div>
      </div>
    </div>
  );
}
