'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import Link from 'next/link';
import { Search, Filter } from 'lucide-react';
import type { Application } from '@/types/database';

const statusLabels: Record<string, { label: string; bg: string; text: string }> = {
  started: { label: 'Started', bg: '#FFFBEB', text: '#D97706' },
  submitted: { label: 'Submitted', bg: '#EFF6FF', text: '#2563EB' },
  under_review: { label: 'In Review', bg: '#F5F3FF', text: '#7C3AED' },
  approved: { label: 'Approved', bg: '#F0FDF4', text: '#059669' },
  declined: { label: 'Declined', bg: '#FEF2F2', text: '#DC2626' },
  withdrawn: { label: 'Withdrawn', bg: '#F4F4F5', text: '#71717A' },
};

type AppWithBiz = Application & { businesses: { legal_name: string } | null };

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<AppWithBiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    supabase
      .from('applications')
      .select('*, businesses(legal_name)')
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setApplications(data as AppWithBiz[]);
        setLoading(false);
      });
  }, []);

  const filtered = applications.filter((a) => {
    const biz = a.businesses?.legal_name?.toLowerCase() ?? '';
    const matchSearch = !search || biz.includes(search.toLowerCase());
    const matchStatus = !filterStatus || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Applications"
        subtitle={`${applications.length} total applications`}
        actions={
          <Link
            href="/apply"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#2563EB] text-white font-semibold text-[13px] h-9 px-4 hover:bg-[#1D4ED8] transition-colors"
          >
            + New Application
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
            <input
              type="text"
              placeholder="Search businesses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#71717A]" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field h-10 text-[14px]"
            >
              <option value="">All Statuses</option>
              {Object.entries(statusLabels).map(([val, { label }]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div
          className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <table className="w-full">
            <thead>
              <tr className="bg-[#F4F4F5]">
                {['Business', 'Status', 'Requested', 'Use of Funds', 'Has Advances', 'Submitted', 'Actions'].map((h) => (
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
                <tr><td colSpan={7} className="text-center py-12 text-[14px] text-[#A1A1AA]">No applications found</td></tr>
              ) : (
                filtered.map((app) => {
                  const s = statusLabels[app.status];
                  return (
                    <tr key={app.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="text-[14px] font-medium text-[#09090B]">
                          {app.businesses?.legal_name ?? '—'}
                        </div>
                        <div className="text-[12px] text-[#A1A1AA]">{app.id.slice(0, 8)}…</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center rounded-[6px] px-2.5 py-1 text-[12px] font-semibold"
                          style={{ backgroundColor: s.bg, color: s.text }}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-[#09090B]">
                        {app.requested_amount ? `$${Number(app.requested_amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-[#71717A]">
                        {app.use_of_funds ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={app.has_existing_advances ? 'badge-warning' : 'badge-success'}>
                          {app.has_existing_advances ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-[#A1A1AA] whitespace-nowrap">
                        {app.submitted_at
                          ? new Date(app.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                          : new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/crm/applications/${app.id}`}
                          className="text-[13px] font-medium text-[#2563EB] hover:underline"
                        >
                          View
                        </Link>
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
