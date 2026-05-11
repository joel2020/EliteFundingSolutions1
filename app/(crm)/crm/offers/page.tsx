'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import type { Offer } from '@/types/database';

const statusColors: Record<string, { bg: string; text: string }> = {
  received: { bg: '#EFF6FF', text: '#2563EB' },
  presented: { bg: '#FFFBEB', text: '#D97706' },
  accepted: { bg: '#F0FDF4', text: '#059669' },
  rejected: { bg: '#FEF2F2', text: '#DC2626' },
  expired: { bg: '#F4F4F5', text: '#71717A' },
  withdrawn: { bg: '#F4F4F5', text: '#71717A' },
};

type OfferWithDeal = Offer & {
  deals: { title: string | null; businesses: { legal_name: string } | null } | null;
  funding_partners: { name: string } | null;
};

export default function OffersPage() {
  const [offers, setOffers] = useState<OfferWithDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('offers')
      .select('*, deals(title, businesses(legal_name)), funding_partners(name)')
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setOffers(data as OfferWithDeal[]);
        setLoading(false);
      });
  }, []);

  const fmt = (n: number | null) => (n ? `$${Number(n).toLocaleString()}` : '—');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Offers"
        subtitle="All funding offers across your pipeline"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div
          className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
        >
          <table className="w-full">
            <thead>
              <tr className="bg-[#F4F4F5]">
                {['Business', 'Partner', 'Amount', 'Factor Rate', 'Payback', 'Daily Pmt', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-[14px] text-[#A1A1AA]">Loading…</td></tr>
              ) : offers.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-[14px] text-[#A1A1AA]">No offers yet</td></tr>
              ) : (
                offers.map((offer) => {
                  const s = statusColors[offer.status] ?? { bg: '#F4F4F5', text: '#71717A' };
                  return (
                    <tr key={offer.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="text-[14px] font-medium text-[#09090B]">
                          {offer.deals?.businesses?.legal_name ?? offer.deals?.title ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-[#71717A]">
                        {offer.funding_partners?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-[14px] font-semibold text-[#09090B]">
                        {fmt(offer.approved_amount)}
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-[#09090B]">
                        {offer.factor_rate ? `${Number(offer.factor_rate).toFixed(2)}x` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-[#71717A]">
                        {fmt(offer.payback_amount)}
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-[#71717A]">
                        {fmt(offer.daily_payment)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center rounded-[6px] px-2.5 py-1 text-[12px] font-semibold capitalize"
                          style={{ backgroundColor: s.bg, color: s.text }}
                        >
                          {offer.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button className="text-[13px] font-medium text-[#2563EB] hover:underline">View</button>
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
