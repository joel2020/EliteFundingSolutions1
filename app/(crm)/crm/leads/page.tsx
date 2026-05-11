'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { Search, Plus } from 'lucide-react';
import type { Lead } from '@/types/database';

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  new: { label: 'New', bg: '#EFF6FF', text: '#2563EB' },
  contacted: { label: 'Contacted', bg: '#FFFBEB', text: '#D97706' },
  qualified: { label: 'Qualified', bg: '#F0FDF4', text: '#059669' },
  application_started: { label: 'App Started', bg: '#F5F3FF', text: '#7C3AED' },
  converted: { label: 'Converted', bg: '#F0FDF4', text: '#059669' },
  lost: { label: 'Lost', bg: '#FEF2F2', text: '#DC2626' },
  unresponsive: { label: 'Unresponsive', bg: '#F4F4F5', text: '#71717A' },
};

const sourceConfig: Record<string, string> = {
  website: 'Website',
  referral: 'Referral',
  broker: 'Broker',
  iso: 'ISO',
  paid_ads: 'Paid Ads',
  organic_search: 'Organic',
  cold_email: 'Cold Email',
  partner: 'Partner',
  manual_entry: 'Manual',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('leads')
      .select('*')
      .eq('organization_id', DEFAULT_ORG_ID)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setLeads(data as Lead[]);
        setLoading(false);
      });
  }, []);

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
      (l.business_name ?? '').toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Leads"
        subtitle={`${leads.length} leads in your pipeline`}
        actions={
          <button className="inline-flex items-center gap-2 rounded-[8px] bg-[#2563EB] text-white font-semibold text-[13px] h-9 px-4 hover:bg-[#1D4ED8] transition-colors">
            <Plus className="w-4 h-4" />
            New Lead
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Search */}
        <div className="relative max-w-[320px] mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <input
            type="text"
            placeholder="Search leads…"
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
                {['Contact', 'Business', 'Source', 'Status', 'Phone', 'Next Follow-Up', 'Actions'].map((h) => (
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
                <tr><td colSpan={7} className="text-center py-12 text-[14px] text-[#A1A1AA]">No leads found</td></tr>
              ) : (
                filtered.map((lead) => {
                  const s = statusConfig[lead.status] ?? { label: lead.status, bg: '#F4F4F5', text: '#71717A' };
                  return (
                    <tr key={lead.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="text-[14px] font-medium text-[#09090B]">
                          {lead.first_name} {lead.last_name}
                        </div>
                        <div className="text-[12px] text-[#A1A1AA]">{lead.email ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-[#71717A]">
                        {lead.business_name ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="badge-default text-[12px]">
                          {sourceConfig[lead.lead_source] ?? lead.lead_source}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center rounded-[6px] px-2.5 py-1 text-[12px] font-semibold"
                          style={{ backgroundColor: s.bg, color: s.text }}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-[#71717A]">
                        {lead.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-[#A1A1AA]">
                        {lead.next_follow_up_at
                          ? new Date(lead.next_follow_up_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <button className="text-[13px] font-medium text-[#2563EB] hover:underline">
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
