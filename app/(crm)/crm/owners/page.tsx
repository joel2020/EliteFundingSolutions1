'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { Owner } from '@/types/database';

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadOwners = async () => {
      const { data, error } = await supabase
        .from('owners')
        .select('*')
        .eq('organization_id', DEFAULT_ORG_ID)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to load owners');
        console.error(error);
      } else {
        setOwners((data || []) as Owner[]);
      }
      setLoading(false);
    };

    loadOwners();
  }, []);

  const filtered = owners.filter((owner) => {
    const q = search.toLowerCase();
    const name = `${owner.first_name || ''} ${owner.last_name || ''}`.toLowerCase();
    return !q || name.includes(q) || (owner.email || '').toLowerCase().includes(q) || (owner.phone || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar title="Owners" subtitle={`${owners.length} business owner profiles`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="relative max-w-[320px] mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <Input placeholder="Search owners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F4F4F5]">
                {['Owner', 'Contact', 'Ownership', 'Credit Range', 'Location', 'Created'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#A1A1AA]">Loading...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <UserRound className="w-10 h-10 mx-auto mb-3 text-[#A1A1AA]" />
                    <p className="text-[#71717A]">No owner profiles found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((owner) => (
                  <tr key={owner.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#09090B]">{owner.first_name} {owner.last_name}</div>
                      <div className="text-xs text-[#71717A]">Owner ID {owner.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-4 py-3 text-[#52525B]">
                      <div>{owner.email || 'No email'}</div>
                      <div className="text-xs text-[#71717A]">{owner.phone || 'No phone'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{owner.ownership_percentage ? `${owner.ownership_percentage}%` : 'Not set'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[#52525B]">{owner.credit_score_range?.replace('_', ' ') || 'Not set'}</td>
                    <td className="px-4 py-3 text-[#52525B]">{[owner.city, owner.state].filter(Boolean).join(', ') || 'Not set'}</td>
                    <td className="px-4 py-3 text-sm text-[#52525B]">
                      {new Date(owner.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
