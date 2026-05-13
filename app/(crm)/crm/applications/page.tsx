'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { Search, MoreVertical, FileText, Edit, ExternalLink, X } from 'lucide-react';
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
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<any[]>([]);

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


  const viewApplicationDetails = async (application: any) => {
    setSelectedApplication(application);
    const [{ data: docs }, { data: history }] = await Promise.all([
      supabase.from('documents').select('*').eq('application_id', application.id).order('created_at', { ascending: false }),
      supabase.from('status_history').select('*').eq('application_id', application.id).order('changed_at', { ascending: false }),
    ]);
    setSelectedDocuments(docs || []);
    setSelectedHistory(history || []);
  };

  const payloadEntries = selectedApplication?.application_payload
    ? Object.entries(selectedApplication.application_payload).filter(([_, value]) => !['authorization_text_version'].includes(_))
    : [];

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
                          <DropdownMenuItem onClick={() => viewApplicationDetails(app as any)}>
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

        {selectedApplication && (
          <div className="mt-6 bg-white border border-[#E4E4E7] rounded-[16px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F4F4F5]">
              <div>
                <h2 className="text-[18px] font-semibold text-[#09090B]">Application Details</h2>
                <p className="text-[13px] text-[#71717A]">Complete digital PDF payload, uploaded files, and activity for CRM review.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedApplication(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="xl:col-span-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#71717A] mb-3">Submitted Fields</h3>
                <div className="max-h-[460px] overflow-auto border border-[#F4F4F5] rounded-[12px]">
                  {payloadEntries.length === 0 ? (
                    <p className="p-4 text-[14px] text-[#A1A1AA]">No digital payload fields are available for this application.</p>
                  ) : payloadEntries.map(([key, value]) => (
                    <div key={key} className="grid grid-cols-1 md:grid-cols-3 gap-2 border-b last:border-b-0 border-[#F4F4F5] px-4 py-3">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#71717A]">{key.replaceAll('_', ' ')}</div>
                      <pre className="md:col-span-2 whitespace-pre-wrap break-words text-[12px] text-[#09090B] font-sans">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#71717A] mb-3">Uploaded Files</h3>
                  <div className="space-y-2">
                    {selectedDocuments.length === 0 ? <p className="text-[14px] text-[#A1A1AA]">No files found.</p> : selectedDocuments.map((doc) => (
                      <div key={doc.id} className="rounded-[10px] border border-[#F4F4F5] p-3">
                        <div className="text-[14px] font-medium text-[#09090B]">{doc.label}</div>
                        <div className="text-[12px] text-[#71717A]">{doc.file_name}</div>
                        <div className="text-[11px] text-[#A1A1AA] break-all">{doc.storage_path}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#71717A] mb-3">Status History</h3>
                  <div className="space-y-2">
                    {selectedHistory.length === 0 ? <p className="text-[14px] text-[#A1A1AA]">No status history found.</p> : selectedHistory.map((item) => (
                      <div key={item.id} className="rounded-[10px] border border-[#F4F4F5] p-3">
                        <div className="text-[14px] font-medium text-[#09090B]">{item.previous_status || 'New'} → {item.new_status}</div>
                        <div className="text-[12px] text-[#71717A]">{item.notes}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
