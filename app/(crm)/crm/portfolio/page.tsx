'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CrmTopbar } from '@/components/crm/topbar';
import { useCrmDataset } from '@/components/crm/crm-platform';

function money(value: any) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function date(value: any) {
  return value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set';
}

function name(row: any) {
  return row.businesses?.dba || row.businesses?.legal_name || row.title || 'Unnamed merchant';
}

export default function PortfolioPage() {
  const { deals, offers, loading } = useCrmDataset();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('date_desc');
  const [lender, setLender] = useState('all');
  const fundedDeals = useMemo(() => deals.filter((deal: any) => deal.stage_slug === 'funded' || deal.funded_at || Number(deal.funded_amount || 0) > 0), [deals]);
  const lenderOptions = Array.from(new Set(fundedDeals.map((deal: any) => offers.find((offer: any) => offer.deal_id === deal.id && ['accepted', 'funded'].includes(offer.status))?.funding_partners?.name).filter(Boolean)));
  const rows = fundedDeals
    .map((deal: any) => ({ deal, offer: offers.find((offer: any) => offer.deal_id === deal.id && ['accepted', 'funded'].includes(offer.status)) || offers.find((offer: any) => offer.deal_id === deal.id) }))
    .filter(({ deal, offer }) => {
      const haystack = [name(deal), offer?.funding_partners?.name, deal.stage_slug].join(' ').toLowerCase();
      return haystack.includes(search.toLowerCase()) && (lender === 'all' || offer?.funding_partners?.name === lender);
    })
    .sort((a, b) => {
      if (sort === 'amount_desc') return Number(b.deal.funded_amount || b.offer?.approved_amount || 0) - Number(a.deal.funded_amount || a.offer?.approved_amount || 0);
      if (sort === 'amount_asc') return Number(a.deal.funded_amount || a.offer?.approved_amount || 0) - Number(b.deal.funded_amount || b.offer?.approved_amount || 0);
      if (sort === 'date_asc') return new Date(a.deal.funded_at || a.deal.updated_at || a.deal.created_at).getTime() - new Date(b.deal.funded_at || b.deal.updated_at || b.deal.created_at).getTime();
      return new Date(b.deal.funded_at || b.deal.updated_at || b.deal.created_at).getTime() - new Date(a.deal.funded_at || a.deal.updated_at || a.deal.created_at).getTime();
    });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar title="Portfolio" subtitle={loading ? 'Loading funded deals...' : `${rows.length} funded deals`} />
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-[#64748B]" /><Input className="h-10 rounded-[7px] pl-9" placeholder="Search funded deals" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <Select value={lender} onValueChange={setLender}><SelectTrigger className="h-10 rounded-[7px] md:w-[220px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All lenders</SelectItem>{lenderOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
          <Select value={sort} onValueChange={setSort}><SelectTrigger className="h-10 rounded-[7px] md:w-[180px]"><ArrowUpDown className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="date_desc">Newest funded</SelectItem><SelectItem value="date_asc">Oldest funded</SelectItem><SelectItem value="amount_desc">Highest amount</SelectItem><SelectItem value="amount_asc">Lowest amount</SelectItem></SelectContent></Select>
        </div>
        <div className="overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">Client</th><th className="px-4 py-3">Funded amount</th><th className="px-4 py-3">Funder / lender</th><th className="px-4 py-3">Funding date</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-[#E2E8F0]">{rows.map(({ deal, offer }) => <tr key={deal.id} className="hover:bg-[#F8FAFC]"><td className="px-4 py-3 font-semibold"><Link href={`/crm/deals/${deal.id}`} className="text-[#0F2B5B]">{name(deal)}</Link></td><td className="px-4 py-3">{money(deal.funded_amount || offer?.approved_amount)}</td><td className="px-4 py-3">{offer?.funding_partners?.name || 'Not set'}</td><td className="px-4 py-3">{date(deal.funded_at)}</td><td className="px-4 py-3">{deal.stage_slug?.replaceAll('_', ' ') || 'funded'}</td></tr>)}</tbody>
          </table>
          {!loading && rows.length === 0 && <div className="p-8 text-center text-sm text-[#64748B]">No funded deals match this view.</div>}
        </div>
      </div>
    </div>
  );
}
