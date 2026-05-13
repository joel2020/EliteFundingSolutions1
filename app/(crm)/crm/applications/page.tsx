'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { Search, Plus, MoreVertical, FileText, Edit, Trash2, ExternalLink } from 'lucide-react';
import type { Application } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: '#F4F4F5', text: '#71717A' },
  submitted: { label: 'Submitted', bg: '#EFF6FF', text: '#2563EB' },
  in_review: { label: 'In Review', bg: '#FEF3C7', text: '#D97706' },
  docs_requested: { label: 'Docs Requested', bg: '#FEE2E2', text: '#DC2626' },
  under_review: { label: 'Under Review', bg: '#DBEAFE', text: '#2563EB' },
  approved: { label: 'Approved', bg: '#D1FAE5', text: '#059669' },
  declined: { label: 'Declined', bg: '#FEE2E2', text: '#DC2626' },
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load applications');
      console.error(error);
    } else if (data) {
      setApplications(data as Application[]);
    }
    setLoading(false);
  };

  const updateStatus = async (appId: string, newStatus: string) => {
    const { error } = await supabase
      .from('applications')
      .update({ status: newStatus })
      .eq('id', appId);

    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success('Status updated');
      loadApplications();
    }
  };

  const filtered = applications.filter((app) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (app.business_name ?? '').toLowerCase().includes(q) ||
      (app.contact_name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Applications"
        subtitle={`${applications.length} applications`}
        actions={
          <Link href="/apply" target="_blank">
            <Button>
              <ExternalLink className="w-4 h-4 mr-2" />
              Application Form
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="relative max-w-[320px] mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" />
          <Input
            type="text"
            placeholder="Search applications…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F4F4F5]">
                {['Business', 'Contact', 'Amount', 'Status', 'Submitted', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#A1A1AA]">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#A1A1AA]">No applications found</td>
                </tr>
              ) : (
                filtered.map((app) => (
                  <tr key={app.id} className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#71717A]" />
                        <span className="font-medium text-[#09090B]">{app.business_name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#52525B]">{app.contact_name || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-[#09090B]">
                      {app.requested_amount ? `$${app.requested_amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className="inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-semibold"
                        style={{ 
                          backgroundColor: statusConfig[app.status]?.bg, 
                          color: statusConfig[app.status]?.text 
                        }}
                      >
                        {statusConfig[app.status]?.label || app.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[#52525B] text-sm">
                      {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toast.info('Application detail workspace is not enabled for this record yet')}>
                            <FileText className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(app.id, 'in_review')}>
                            <Edit className="w-4 h-4 mr-2" />
                            Mark In Review
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
