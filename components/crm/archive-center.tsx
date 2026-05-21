'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { FileArchive, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CrmTopbar } from '@/components/crm/topbar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCrmUser } from '@/lib/crm-auth';

type ArchivedRecord = Record<string, any>;
type ArchiveType = 'lenders' | 'brokers' | 'users';

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function recordLabel(type: ArchiveType, record: ArchivedRecord) {
  if (type === 'lenders') return record.name || 'Unnamed lender';
  if (type === 'brokers') return [record.company_name, record.broker_name].filter(Boolean).join(' / ') || record.email || 'Unnamed broker';
  return [record.first_name, record.last_name].filter(Boolean).join(' ') || record.email || 'Unnamed user';
}

function restoreEndpoint(type: ArchiveType, id: string) {
  if (type === 'lenders') return `/api/crm/partners/${id}/restore`;
  if (type === 'brokers') return `/api/crm/iso-brokers/${id}/restore`;
  return `/api/crm/users/${id}/restore`;
}

function canRestore(type: ArchiveType, role?: string) {
  if (type === 'users') return ['super_admin', 'admin'].includes(role || '');
  return ['super_admin', 'admin', 'manager'].includes(role || '');
}

function ArchiveTable({
  type,
  rows,
  role,
  restoringId,
  onRestore,
}: {
  type: ArchiveType;
  rows: ArchivedRecord[];
  role?: string;
  restoringId: string | null;
  onRestore: (type: ArchiveType, record: ArchivedRecord) => void;
}) {
  const allowed = canRestore(type, role);

  return (
    <div className="overflow-x-auto rounded-[8px] border border-[#E2E8F0] bg-white">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-[#F8FAFC] text-[11px] uppercase text-[#64748B]">
          <tr>
            {['Record', 'Archived', 'Status', 'Reference', 'Actions'].map((head) => (
              <th key={head} className="px-4 py-3">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {rows.length ? rows.map((record) => (
            <tr key={record.id} data-testid={`archive-${type}-${record.id}`}>
              <td className="px-4 py-3">
                <p className="font-semibold text-[#0F172A]">{recordLabel(type, record)}</p>
                <p className="text-xs text-[#64748B]">{record.email || record.submission_email || record.phone || 'No contact saved'}</p>
              </td>
              <td className="px-4 py-3 text-[#334155]">{formatDate(record.deleted_at)}</td>
              <td className="px-4 py-3">{record.is_active ? 'Active' : 'Inactive'}</td>
              <td className="px-4 py-3 text-xs text-[#64748B]">{record.id}</td>
              <td className="px-4 py-3">
                {allowed ? (
                  <Button
                    data-testid={`restore-${type}-${record.id}`}
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-[7px]"
                    disabled={restoringId === record.id}
                    onClick={() => onRestore(type, record)}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    {restoringId === record.id ? 'Restoring' : 'Restore'}
                  </Button>
                ) : (
                  <span className="text-xs text-[#64748B]">Read only</span>
                )}
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#64748B]">No archived records.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ArchiveCenter() {
  const { profile, organizationId, loading: profileLoading, error: profileError } = useCrmUser();
  const browserSupabase = useMemo(() => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<ArchiveType, ArchivedRecord[]>>({
    lenders: [],
    brokers: [],
    users: [],
  });

  const load = useCallback(async () => {
    const org = organizationId || ORG_ID;
    setLoading(true);
    setError(null);

    const [lenders, brokers, users] = await Promise.all([
      browserSupabase.from('funding_partners').select('*').eq('organization_id', org).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      browserSupabase.from('iso_brokers').select('*').eq('organization_id', org).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      browserSupabase.from('user_profiles').select('*').eq('organization_id', org).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
    ]);

    const failed = [lenders, brokers, users].find((result) => result.error);
    if (failed?.error) {
      setError(failed.error.message);
      setRecords({ lenders: [], brokers: [], users: [] });
    } else {
      setRecords({
        lenders: lenders.data || [],
        brokers: brokers.data || [],
        users: users.data || [],
      });
    }
    setLoading(false);
  }, [browserSupabase, organizationId]);

  useEffect(() => {
    if (!profileLoading && !profileError) load();
  }, [load, profileError, profileLoading]);

  const restore = async (type: ArchiveType, record: ArchivedRecord) => {
    setRestoringId(record.id);
    try {
      const response = await fetch(restoreEndpoint(type, record.id), { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        toast.error(result.error || 'Unable to restore record.');
      } else {
        toast.success(`${recordLabel(type, record)} restored`);
        await load();
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRestoringId(null);
    }
  };

  if (profileLoading || loading) {
    return <div className="min-h-screen bg-[#F6F7FB] p-6 text-sm text-[#64748B]">Loading archive...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-[#0F172A]">
      <CrmTopbar title="Archived Records" subtitle="Restore archived lenders, brokers, and users without losing historical references." />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#E2E8F0] bg-white p-4">
          <div className="flex items-center gap-3">
            <FileArchive className="h-5 w-5 text-[#0F2B5B]" />
            <div>
              <h1 className="text-base font-semibold">Archive Center</h1>
              <p className="text-sm text-[#64748B]">Deleted CRM directory records stay here until an authorized user restores them.</p>
            </div>
          </div>
          <Button variant="outline" className="h-9 rounded-[7px]" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {error ? <div className="mb-4 rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <Tabs defaultValue="lenders" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lenders">Lenders ({records.lenders.length})</TabsTrigger>
            <TabsTrigger value="brokers">Brokers ({records.brokers.length})</TabsTrigger>
            <TabsTrigger value="users">Users ({records.users.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="lenders">
            <ArchiveTable type="lenders" rows={records.lenders} role={profile?.role} restoringId={restoringId} onRestore={restore} />
          </TabsContent>
          <TabsContent value="brokers">
            <ArchiveTable type="brokers" rows={records.brokers} role={profile?.role} restoringId={restoringId} onRestore={restore} />
          </TabsContent>
          <TabsContent value="users">
            <ArchiveTable type="users" rows={records.users} role={profile?.role} restoringId={restoringId} onRestore={restore} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
