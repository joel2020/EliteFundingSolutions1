'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { Plus } from 'lucide-react';
import type { FundingPartner } from '@/types/database';

export default function PartnersPage() {
  const [partners, setPartners] = useState<FundingPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('funding_partners')
      .select('*')
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('name')
      .then(({ data }) => {
        if (data) setPartners(data as FundingPartner[]);
        setLoading(false);
      });
  }, []);

  const fmt = (n: number | null) => (n ? `$${(n / 1000).toFixed(0)}K` : '—');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Funding Partners"
        subtitle="Manage your lender and funder network"
        actions={
          <button className="inline-flex items-center gap-2 rounded-[8px] bg-[#2563EB] text-white font-semibold text-[13px] h-9 px-4 hover:bg-[#1D4ED8] transition-colors">
            <Plus className="w-4 h-4" />
            Add Partner
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <p className="text-[14px] text-[#A1A1AA]">Loading…</p>
          ) : partners.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-[#E4E4E7] rounded-[16px] p-5 hover:border-[#D4D4D8] transition-all"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#09090B]">{p.name}</h3>
                  <p className="text-[13px] text-[#71717A]">{p.contact_name ?? '—'}</p>
                </div>
                <span className={`badge-${p.is_active ? 'success' : 'default'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#F4F4F5] rounded-[8px] p-2">
                  <div className="text-[11px] text-[#A1A1AA]">Min Funding</div>
                  <div className="text-[13px] font-semibold text-[#09090B]">{fmt(p.min_funding_amount)}</div>
                </div>
                <div className="bg-[#F4F4F5] rounded-[8px] p-2">
                  <div className="text-[11px] text-[#A1A1AA]">Max Funding</div>
                  <div className="text-[13px] font-semibold text-[#09090B]">{fmt(p.max_funding_amount)}</div>
                </div>
                <div className="bg-[#F4F4F5] rounded-[8px] p-2">
                  <div className="text-[11px] text-[#A1A1AA]">Avg Decision</div>
                  <div className="text-[13px] font-semibold text-[#09090B]">{p.avg_approval_days ? `${p.avg_approval_days}d` : '—'}</div>
                </div>
              </div>
              {p.email && (
                <a href={`mailto:${p.email}`} className="text-[12px] text-[#2563EB] hover:underline mt-3 block">
                  {p.email}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
