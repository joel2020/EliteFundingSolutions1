'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { Search, Plus } from 'lucide-react';
import type { Business } from '@/types/database';

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('businesses')
      .select('*')
      .eq('organization_id', DEFAULT_ORG_ID)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setBusinesses(data as Business[]);
        setLoading(false);
      });
  }, []);

  const filtered = businesses.filter((b) =>
    !search || b.legal_name.toLowerCase().includes(search.toLowerCase())
  );

  const fmtRevenue = (n: number | null) =>
    n ? `$${(n / 1000).toFixed(0)}K/mo` : '—';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Businesses"
        subtitle={`${businesses.length} business records`}
        actions={
          <button className="inline-flex items-center gap-2 rounded-[8px] bg-[#2563EB] text-white font-semibold text-[13px] h-9 px-4 hover:bg-[#1D4ED8] transition-colors">
            <Plus className="w-4 h-4" />
            Add Business
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="relative max-w-[320px] mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <input
            type="text"
            placeholder="Search businesses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field w-full pl-9"
          />
        </div>

        <div
          className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <table className="w-full">
            <thead>
              <tr className="bg-[#F4F4F5]">
                {['Business', 'Industry', 'Entity', 'Monthly Revenue', 'Location', 'Start Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-[14px] text-[#A1A1AA]">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-[14px] text-[#A1A1AA]">No businesses found</td></tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="text-[14px] font-medium text-[#09090B]">{b.legal_name}</div>
                      {b.dba && <div className="text-[12px] text-[#A1A1AA]">dba {b.dba}</div>}
                    </td>
                    <td className="px-4 py-3.5 text-[14px] text-[#71717A]">{b.industry ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="badge-default uppercase text-[11px]">
                        {b.entity_type?.replace('_', ' ') ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[14px] font-medium text-[#09090B]">
                      {fmtRevenue(b.monthly_gross_revenue)}
                    </td>
                    <td className="px-4 py-3.5 text-[14px] text-[#71717A]">
                      {b.city && b.state ? `${b.city}, ${b.state}` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-[#A1A1AA]">
                      {b.start_date ? new Date(b.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <button className="text-[13px] font-medium text-[#2563EB] hover:underline">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
