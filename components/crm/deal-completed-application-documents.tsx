import { Download, FileText } from 'lucide-react';
import { requireCrmProfile } from '@/lib/server-auth';

function formatBytes(bytes?: number | null) {
  if (!bytes) return 'PDF';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Uploaded';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export async function DealCompletedApplicationDocuments({ dealId }: { dealId: string }) {
  const auth = await requireCrmProfile();
  if ('response' in auth) return null;

  const { profile, supabase } = auth;
  const { data: documents } = await supabase
    .from('documents')
    .select('id,file_name,label,file_size,status,created_at')
    .eq('organization_id', profile.organization_id)
    .eq('deal_id', dealId)
    .eq('document_type', 'completed_application')
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!documents?.length) return null;

  return (
    <section className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 lg:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-[#64748B]">Signed application package</p>
          <h2 className="mt-1 text-sm font-semibold text-[#0F172A]">Completed application PDF attached to this deal</h2>
        </div>
        <div className="flex min-w-0 flex-col gap-2 lg:max-w-[760px]">
          {documents.map((document) => (
            <div key={document.id} className="flex min-w-0 flex-col gap-2 rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-[#0F2B5B]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0F172A]">{document.label || 'Signed Elite Funding Solutions application'}</p>
                  <p className="truncate text-xs text-[#64748B]">{document.file_name || 'completed-application.pdf'} · completed_application · {formatBytes(document.file_size)} · {formatDate(document.created_at)}</p>
                </div>
              </div>
              <a
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-[7px] border border-[#CBD5E1] px-3 text-sm font-semibold text-[#0F2B5B] transition hover:bg-[#F1F5F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2B5B] focus-visible:ring-offset-2"
                href={`/api/crm/documents/${document.id}/download`}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
