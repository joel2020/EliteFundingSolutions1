'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { CircleAlert as AlertCircle, User, DollarSign, TrendingUp } from 'lucide-react';
import type { DealSummary } from '@/types/database';

const STAGE_ORDER = [
  { slug: 'lead_captured', label: 'Lead Captured', color: '#A1A1AA' },
  { slug: 'application_submitted', label: 'Submitted', color: '#2563EB' },
  { slug: 'documents_received', label: 'Docs In', color: '#2563EB' },
  { slug: 'underwriting_review', label: 'Underwriting', color: '#8B5CF6' },
  { slug: 'offers_received', label: 'Offers', color: '#10B981' },
  { slug: 'contract_sent', label: 'Contract Out', color: '#F59E0B' },
  { slug: 'funded', label: 'Funded', color: '#10B981' },
];

export default function PipelinePage() {
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('deal_summary_view')
      .select('*')
      .eq('organization_id', DEFAULT_ORG_ID)
      .then(({ data }) => {
        if (data) setDeals(data as DealSummary[]);
        setLoading(false);
      });
  }, []);

  const dealsByStage = (slug: string) =>
    deals.filter((d) => d.stage_slug === slug);

  const handleDragStart = (id: string) => setDragId(id);

  const handleDrop = async (targetSlug: string) => {
    if (!dragId) return;
    const deal = deals.find((d) => d.id === dragId);
    if (!deal || deal.stage_slug === targetSlug) { setDragId(null); return; }

    setDeals((prev) =>
      prev.map((d) => d.id === dragId ? { ...d, stage_slug: targetSlug } : d)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('deals')
      .update({ stage_slug: targetSlug })
      .eq('id', dragId);

    setDragId(null);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Pipeline"
        subtitle="Drag and drop deals between stages"
        actions={
          <button className="inline-flex items-center gap-2 rounded-[8px] bg-[#2563EB] text-white font-semibold text-[13px] h-9 px-4 hover:bg-[#1D4ED8] transition-colors">
            + New Deal
          </button>
        }
      />

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-4 h-full min-w-max">
          {STAGE_ORDER.map((stage) => {
            const stagDeals = dealsByStage(stage.slug);
            const totalAmt = stagDeals.reduce((s, d) => s + (d.requested_amount ?? 0), 0);

            return (
              <div
                key={stage.slug}
                className="w-[280px] flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage.slug)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="text-[13px] font-semibold text-[#09090B]">{stage.label}</span>
                    <span className="text-[12px] text-[#A1A1AA] bg-[#F4F4F5] rounded-full px-2 py-0.5">
                      {stagDeals.length}
                    </span>
                  </div>
                  {totalAmt > 0 && (
                    <span className="text-[12px] text-[#71717A]">
                      ${(totalAmt / 1000).toFixed(0)}K
                    </span>
                  )}
                </div>

                {/* Column body */}
                <div
                  className={`flex-1 overflow-y-auto flex flex-col gap-3 p-2 rounded-[12px] transition-colors min-h-[200px] ${
                    dragId ? 'bg-[#F4F4F5]' : 'bg-[#F4F4F5]/50'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center h-24 text-[13px] text-[#A1A1AA]">Loading…</div>
                  ) : stagDeals.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-[13px] text-[#A1A1AA] border-2 border-dashed border-[#E4E4E7] rounded-[10px]">
                      Drop here
                    </div>
                  ) : (
                    stagDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onDragStart={() => handleDragStart(deal.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DealCard({ deal, onDragStart }: { deal: DealSummary; onDragStart: () => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white border border-[#E4E4E7] rounded-[12px] p-4 cursor-grab active:cursor-grabbing hover:border-[#D4D4D8] hover:shadow-md transition-all duration-150 select-none"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="mb-3">
        <h4 className="text-[14px] font-semibold text-[#09090B] leading-tight mb-0.5">
          {deal.business_name ?? 'Unknown Business'}
        </h4>
        {deal.business_dba && (
          <p className="text-[12px] text-[#A1A1AA]">dba {deal.business_dba}</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[13px] text-[#52525B]">
          <DollarSign className="w-3.5 h-3.5 text-[#A1A1AA]" />
          <span className="font-medium">
            {deal.requested_amount ? `$${(deal.requested_amount / 1000).toFixed(0)}K` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[12px] text-[#71717A]">
          <TrendingUp className="w-3.5 h-3.5" />
          {deal.funding_probability}%
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] text-[#71717A]">
          <User className="w-3 h-3" />
          {deal.assigned_rep_name ?? 'Unassigned'}
        </div>
        {(deal.missing_documents ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-[#D97706] font-medium">
            <AlertCircle className="w-3 h-3" />
            {deal.missing_documents} doc{(deal.missing_documents ?? 0) > 1 ? 's' : ''} needed
          </div>
        )}
      </div>

      {deal.industry && (
        <div className="mt-3 pt-3 border-t border-[#F4F4F5]">
          <span className="text-[11px] text-[#A1A1AA]">{deal.industry}</span>
        </div>
      )}
    </div>
  );
}
