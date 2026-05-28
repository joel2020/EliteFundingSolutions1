'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Search, MoreVertical, FileText, Edit, ExternalLink, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

const sensitiveKeyPattern = /(ssn|social|dob|birth|ein|tax|routing|account|bank|processor|statement|license|document|financial)/i;

function maskValue(key: string, value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => maskValue(key, item));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, maskValue(childKey, childValue)]));
  }
  if (!sensitiveKeyPattern.test(key)) return value;
  const text = String(value);
  if (!text) return value;
  const last4 = text.replace(/\D/g, '').slice(-4) || text.slice(-4);
  return `••••${last4}`;
}

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
  const { profile: crmProfile, organizationId, loading: crmUserLoading, error: crmUserError } = useCrmUser();

  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<any[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<any[]>([]);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [signatureAuthorized, setSignatureAuthorized] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadCurrentProfile = useCallback(async () => {
    if (!organizationId) return;
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('id, role, organization_id')
      .eq('user_id', authData.user.id)
      .eq('organization_id', organizationId)
      .single();
    setCurrentProfile(data);
  }, [organizationId]);

  const loadApplications = useCallback(async () => {
    if (!organizationId) return;
    const { data, error } = await supabase
      .from('applications')
      .select('id,organization_id,business_id,status,requested_amount,submitted_at,created_at,application_payload,certification_accepted,credit_authorization_accepted,esign_consent_accepted,sms_consent_accepted,terms_accepted,privacy_policy_accepted,signed_name,signed_at,signature_date,businesses(legal_name,dba,email,phone,ein_last4),leads(first_name,last_name,email,phone)')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load applications');
      console.error(error);
    } else if (data) {
      setApplications(data as any[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { setLoading(false); return; }
    loadApplications();
    loadCurrentProfile();
  }, [crmUserLoading, organizationId, loadApplications, loadCurrentProfile]);

  const updateStatus = async (appId: string, newStatus: string) => {
    const response = await fetch(`/api/crm/applications/${appId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, notes: 'Application table status action.' }),
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      toast.error(result.error || 'Failed to update status');
    } else {
      toast.success('Status updated');
      loadApplications();
    }
  };


  const viewApplicationDetails = async (application: any) => {
    setSelectedApplication(application);
    setRevealSensitive(false);
    const [{ data: docs }, { data: history }] = await Promise.all([
      supabase.from('documents').select('id,label,file_name,document_type,status,created_at').eq('application_id', application.id).eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('status_history').select('id,previous_status,new_status,notes,changed_at').eq('application_id', application.id).eq('organization_id', organizationId).order('changed_at', { ascending: false }),
    ]);
    setSelectedDocuments(docs || []);
    setSelectedHistory(history || []);
  };

  const canRevealSensitive = ['super_admin', 'admin'].includes(currentProfile?.role);

  const importPartnerPdf = async (commit = false) => {
    if (!importFile) {
      toast.error('Select a partner PDF application.');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.set('file', importFile);
      if (commit) {
        formData.set('review_confirmed', 'true');
        formData.set('signature_authorized', signatureAuthorized ? 'true' : 'false');
      }
      const response = await fetch('/api/crm/applications/import-partner-pdf', { method: 'POST', body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Unable to import partner PDF.');
      if (result.preview) {
        setImportPreview(result.extracted);
        toast.success('Partner PDF analyzed. Review the extracted data before creating CRM records.');
        return;
      }

      toast.success(`Imported ${result.extracted?.business_name || 'partner application'} and generated Elite PDF.`);
      setImportDialogOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setSignatureAuthorized(false);
      loadApplications();
    } catch (error: any) {
      toast.error(error.message || 'Unable to import partner PDF.');
    }
    setImporting(false);
  };

  const revealSensitiveFields = async () => {
    if (!selectedApplication || !canRevealSensitive) {
      toast.error('Only Super Admin/Admin can reveal sensitive fields.');
      return;
    }
    const { error } = await supabase.rpc('log_sensitive_field_reveal', {
      p_application_id: selectedApplication.id,
      p_field_name: 'application_payload',
      p_reason: 'CRM application detail review',
    });
    if (error) {
      toast.error('Unable to audit sensitive-field reveal.');
      return;
    }
    setRevealSensitive(true);
    toast.success('Sensitive-field reveal audited.');
  };

  const payloadEntries = selectedApplication?.application_payload
    ? Object.entries(selectedApplication.application_payload).filter(([key]) => !['authorization_text_version', 'bot_field'].includes(key))
    : [];

  const filtered = applications.filter((app) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      ((app.businesses?.legal_name || app.businesses?.dba || '')).toLowerCase().includes(q) ||
      ((app.leads?.first_name || '') + ' ' + (app.leads?.last_name || '')).toLowerCase().includes(q) ||
      (app.leads?.email || app.businesses?.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Applications"
        subtitle={`${applications.length} applications`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import Partner PDF
            </Button>
            <Link href="/apply" target="_blank">
              <Button>
                <ExternalLink className="w-4 h-4 mr-2" />
                Application Form
              </Button>
            </Link>
          </div>
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
                        <span className="font-medium text-[#09090B]">{app.businesses?.legal_name || app.businesses?.dba || 'Unlinked business'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#52525B]">{[app.leads?.first_name, app.leads?.last_name].filter(Boolean).join(' ') || app.leads?.email || app.businesses?.email || '—'}</td>
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
                          <DropdownMenuItem onClick={() => updateStatus(app.id, 'under_review')}>
                            <Edit className="w-4 h-4 mr-2" />
                            Move to Underwriting
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
                <p className="text-[13px] text-[#71717A]">Sensitive fields are masked by default. Super Admin/Admin reveals are audited in activity logs.</p>
              </div>
              <div className="flex items-center gap-2">{canRevealSensitive && !revealSensitive && <Button variant="outline" size="sm" onClick={revealSensitiveFields}>Reveal sensitive fields</Button>}<Button variant="ghost" size="sm" onClick={() => setSelectedApplication(null)}><X className="w-4 h-4" /></Button></div>
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
                      <pre className="md:col-span-2 whitespace-pre-wrap break-words text-[12px] text-[#09090B] font-sans">{typeof (revealSensitive ? value : maskValue(key, value)) === 'string' ? (revealSensitive ? value : maskValue(key, value)) : JSON.stringify(revealSensitive ? value : maskValue(key, value), null, 2)}</pre>
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

      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) { setImportPreview(null); setImportFile(null); setSignatureAuthorized(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Partner PDF Application</DialogTitle>
            <DialogDescription>Upload a text-based partner application PDF. Review extracted fields before the CRM creates records or generates the Elite Funding PDF application.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="partner-pdf">Partner PDF</Label>
            <Input
              id="partner-pdf"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => { setImportFile(event.target.files?.[0] || null); setImportPreview(null); setSignatureAuthorized(false); }}
            />
            {importFile && <p className="mt-2 text-sm text-[#71717A]">{importFile.name}</p>}
            {importPreview && (
              <div className="rounded-[12px] border border-[#E4E4E7] bg-[#FAFAFA] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#09090B]">Review extracted application data</h3>
                    <p className="text-xs text-[#71717A]">No CRM records are created until you confirm this review.</p>
                  </div>
                  <Badge variant="secondary">{importPreview.extraction_confidence || 0}% confidence</Badge>
                </div>
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  <div><b>Business:</b> {importPreview.business_name || 'Missing'}</div>
                  <div><b>Owner:</b> {importPreview.owner_name || 'Missing'}</div>
                  <div><b>Email:</b> {importPreview.owner_email || 'Missing'}</div>
                  <div><b>Requested:</b> {importPreview.requested_amount ? `$${Number(importPreview.requested_amount).toLocaleString()}` : 'Missing'}</div>
                  <div><b>EIN last 4:</b> {importPreview.ein_last4 || 'Missing'}</div>
                  <div><b>SSN last 4:</b> {importPreview.ssn_last4 || 'Missing'}</div>
                  <div><b>Signature:</b> {importPreview.signature_present ? 'Present' : 'Missing'}</div>
                  <div><b>Signature date:</b> {importPreview.signature_date || 'Missing'}</div>
                </div>
                {importPreview.missing_fields?.length > 0 && <div className="mt-3 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Missing or uncertain fields: {importPreview.missing_fields.join(', ')}</div>}
                {importPreview.signature_present && (
                  <label className="mt-4 flex items-start gap-2 text-sm text-[#27272A]">
                    <input type="checkbox" checked={signatureAuthorized} onChange={(event) => setSignatureAuthorized(event.target.checked)} className="mt-1" />
                    <span>I reviewed the partner application and confirm its authorization allows Elite Funding Solutions to use the imported customer signature to generate the Elite application.</span>
                  </label>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>Cancel</Button>
            {!importPreview ? (
              <Button onClick={() => importPartnerPdf(false)} disabled={importing || !importFile}>{importing ? 'Analyzing...' : 'Analyze PDF'}</Button>
            ) : (
              <Button onClick={() => importPartnerPdf(true)} disabled={importing || !importFile || (importPreview.signature_present && !signatureAuthorized)}>{importing ? 'Creating...' : 'Create Elite Application'}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
