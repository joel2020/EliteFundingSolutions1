'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Calendar, DollarSign, Download, Eye, File, FileArchive, FileText, Image as ImageIcon, Landmark, MessageSquarePlus, Send, Trash2, Upload } from 'lucide-react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const tabs = ['overview', 'documents', 'notes', 'lenders', 'offers', 'activity'] as const;
type TabId = (typeof tabs)[number];

const tabLabels: Record<TabId, string> = {
  overview: 'Overview',
  documents: 'Documents',
  notes: 'Notes',
  lenders: 'Lenders Sent To',
  offers: 'Offers',
  activity: 'Activity',
};

const stageLabels: Record<string, string> = {
  lead_captured: 'Lead Captured',
  application_started: 'Application Started',
  application_submitted: 'Application Submitted',
  documents_requested: 'Documents Requested',
  documents_received: 'Documents Received',
  underwriting_review: 'Underwriting Review',
  submitted_to_partners: 'Submitted to Partners',
  offers_received: 'Offers Received',
  offer_presented: 'Offer Presented',
  contract_sent: 'Contract Sent',
  contract_signed: 'Contract Signed',
  funded: 'Funded',
  renewal_eligible: 'Renewal Eligible',
  declined: 'Declined',
  lost_unresponsive: 'Lost / Unresponsive',
};

const documentTypes = [
  ['application', 'Application'],
  ['bank_statement', 'Bank Statement'],
  ['processing_statement', 'Processing Statement'],
  ['tax_return', 'Tax Return'],
  ['drivers_license', "Driver's License"],
  ['voided_check', 'Voided Check'],
  ['business_license', 'Business License'],
  ['articles_of_incorporation', 'Articles of Incorporation'],
  ['ein_letter', 'EIN Letter'],
  ['lease_agreement', 'Lease Agreement'],
  ['proof_of_ownership', 'Proof of Ownership'],
  ['existing_funding_statement', 'Existing Funding Statement'],
  ['contract', 'Contract'],
  ['other', 'Other'],
] as const;

const submissionStatuses = [
  ['draft', 'Draft'],
  ['submitted', 'Sent'],
  ['in_review', 'Reviewing'],
  ['more_info_needed', 'Needs More Documents'],
  ['approved', 'Approved'],
  ['declined', 'Declined'],
  ['withdrawn', 'Withdrawn'],
] as const;

function money(value?: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fileSize(bytes?: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docLabel(type: string) {
  const normalized = type === 'bank_statements' ? 'bank_statement' : type;
  return documentTypes.find(([value]) => value === normalized)?.[1] || normalized.replaceAll('_', ' ');
}

function statusLabel(status: string) {
  return submissionStatuses.find(([value]) => value === status)?.[1] || status.replaceAll('_', ' ');
}

function fileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext || '')) return <ImageIcon className="h-5 w-5" />;
  if (ext === 'pdf') return <FileText className="h-5 w-5" />;
  if (['zip', 'rar'].includes(ext || '')) return <FileArchive className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
}

export function DealDetailClient({ dealId }: { dealId: string }) {
  const router = useRouter();
  const { organizationId, profile, loading: crmUserLoading, error: crmUserError } = useCrmUser();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

  const [showUpload, setShowUpload] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [showLender, setShowLender] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('application');
  const [documentNotes, setDocumentNotes] = useState('');
  const [noteType, setNoteType] = useState('Internal note');
  const [noteBody, setNoteBody] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('submitted');
  const [submissionNotes, setSubmissionNotes] = useState('');

  const canDeleteDocuments = ['super_admin', 'admin', 'manager', 'processor'].includes(profile?.role || '');
  const dealName = deal?.businesses?.legal_name || deal?.businesses?.dba || deal?.title || 'Deal detail';
  const lastActivity = activities[0]?.created_at || documents[0]?.created_at || submissions[0]?.updated_at || deal?.updated_at;

  const addActivity = useCallback(async (title: string, body: string | null, type = 'system') => {
    if (!organizationId || !dealId) return;
    await supabase.from('activities').insert({
      organization_id: organizationId,
      deal_id: dealId,
      application_id: deal?.application_id || null,
      business_id: deal?.business_id || null,
      activity_type: type,
      title,
      body,
      direction: 'internal',
      performed_by: profile?.id || null,
    });
  }, [deal?.application_id, deal?.business_id, dealId, organizationId, profile?.id]);

  const loadDeal = useCallback(async () => {
    if (!organizationId || !dealId) return;
    setLoading(true);

    const [dealResult, docsResult, activityResult, submissionResult, offerResult, partnerResult] = await Promise.all([
      supabase
        .from('deals')
        .select('id,organization_id,application_id,business_id,title,stage_slug,requested_amount,approved_amount,funded_amount,funding_probability,funded_at,declined_at,decline_reason,notes,tags,created_at,updated_at,businesses(legal_name,dba,industry,phone,email,city,state),applications(id,status,submitted_at,requested_amount,use_of_funds,desired_timeline)')
        .eq('id', dealId)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .single(),
      supabase.from('documents').select('id,document_type,label,file_name,file_size,mime_type,status,review_notes,created_at').eq('deal_id', dealId).eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('activities').select('id,activity_type,title,body,direction,created_at').eq('deal_id', dealId).eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(100),
      supabase.from('partner_submissions').select('id,funding_partner_id,submitted_at,status,decline_reason,response_date,notes,created_at,updated_at,funding_partners(name,submission_email,email)').eq('deal_id', dealId).eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('offers').select('id,approved_amount,factor_rate,payback_amount,term_days,payment_frequency,daily_payment,weekly_payment,status,expires_at,notes,created_at,funding_partners(name)').eq('deal_id', dealId).eq('organization_id', organizationId).order('created_at', { ascending: false }),
      supabase.from('funding_partners').select('id,name,submission_email,email').eq('organization_id', organizationId).eq('is_active', true).order('name', { ascending: true }),
    ]);

    if (dealResult.error) {
      toast.error('Failed to load deal');
      console.error(dealResult.error);
      setDeal(null);
    } else {
      setDeal(dealResult.data);
    }

    if (docsResult.error) console.error(docsResult.error); else setDocuments(docsResult.data || []);
    if (activityResult.error) console.error(activityResult.error); else setActivities(activityResult.data || []);
    if (submissionResult.error) console.error(submissionResult.error); else setSubmissions(submissionResult.data || []);
    if (offerResult.error) console.error(offerResult.error); else setOffers(offerResult.data || []);
    if (partnerResult.error) console.error(partnerResult.error); else setPartners(partnerResult.data || []);
    setLoading(false);
  }, [dealId, organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) {
      toast.error(crmUserError || 'Your CRM profile is not active.');
      setLoading(false);
      return;
    }
    loadDeal();
  }, [crmUserLoading, organizationId, crmUserError, loadDeal]);

  const docStatusCounts = useMemo(() => documents.reduce((acc, doc) => ({ ...acc, [doc.status]: (acc[doc.status] || 0) + 1 }), {} as Record<string, number>), [documents]);

  const uploadDocument = async () => {
    if (!organizationId || !dealId || !file) {
      toast.error('Please select a file');
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (file.size > 10 * 1024 * 1024 || (!allowed.includes(file.type) && !['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext || ''))) {
      toast.error('Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.');
      return;
    }

    setSaving(true);
    try {
      const storagePath = `${organizationId}/deals/${dealId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const label = docLabel(documentType);
      const { error: uploadError } = await supabase.storage.from('application-documents').upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('documents').insert({
        organization_id: organizationId,
        deal_id: dealId,
        application_id: deal?.application_id || null,
        document_type: documentType,
        label,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        storage_path: storagePath,
        review_notes: documentNotes || null,
      });
      if (insertError) throw insertError;
      await addActivity('Document uploaded', `${label}: ${file.name}`, 'document_event');
      toast.success('Document uploaded to this deal');
      setShowUpload(false);
      setFile(null);
      setDocumentType('application');
      setDocumentNotes('');
      loadDeal();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const openDocument = async (doc: any, disposition: 'preview' | 'download') => {
    const response = await fetch(`/api/documents/${doc.id}/signed-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disposition }) });
    const result = await response.json();
    if (!response.ok || !result.success) {
      toast.error(result.error || 'Unable to open document');
      return;
    }
    window.open(result.url, '_blank', 'noopener,noreferrer');
  };

  const deleteDocument = async (doc: any) => {
    if (!confirm('Delete this document from this deal?')) return;
    const response = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.success) {
      toast.error(result.error || 'Failed to delete document');
      return;
    }
    await addActivity('Document deleted', doc.file_name, 'document_event');
    toast.success('Document deleted');
    loadDeal();
  };

  const saveNote = async () => {
    if (!noteBody.trim()) return;
    setSaving(true);
    try {
      await addActivity(noteType, noteBody.trim(), 'note');
      toast.success('Note added');
      setShowNote(false);
      setNoteType('Internal note');
      setNoteBody('');
      loadDeal();
    } finally {
      setSaving(false);
    }
  };

  const saveLender = async () => {
    if (!organizationId || !dealId || !partnerId) {
      toast.error('Select a lender');
      return;
    }
    setSaving(true);
    try {
      const partner = partners.find((item) => item.id === partnerId);
      const { error } = await supabase.from('partner_submissions').insert({
        organization_id: organizationId,
        deal_id: dealId,
        funding_partner_id: partnerId,
        submitted_by: profile?.id || null,
        submitted_at: submissionStatus === 'draft' ? null : new Date().toISOString(),
        status: submissionStatus,
        notes: submissionNotes || null,
      });
      if (error) throw error;
      await addActivity('Lender submission added', `${partner?.name || 'Lender'}: ${statusLabel(submissionStatus)}`);
      toast.success('Lender added to deal');
      setShowLender(false);
      setPartnerId('');
      setSubmissionStatus('submitted');
      setSubmissionNotes('');
      loadDeal();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add lender');
    } finally {
      setSaving(false);
    }
  };

  const updateLenderStatus = async (submission: any, nextStatus: string) => {
    if (!organizationId) return;
    const { error } = await supabase.from('partner_submissions').update({ status: nextStatus, response_date: new Date().toISOString() }).eq('id', submission.id).eq('organization_id', organizationId);
    if (error) {
      toast.error(error.message || 'Failed to update lender');
      return;
    }
    await addActivity('Lender status updated', `${submission.funding_partners?.name || 'Lender'}: ${statusLabel(nextStatus)}`);
    toast.success('Lender status updated');
    loadDeal();
  };

  if (loading) {
    return <div className="flex h-full flex-col overflow-hidden"><CrmTopbar title="Deal Detail" subtitle="Loading deal…" /><div className="flex-1 overflow-y-auto bg-[#F6F7FA] p-6"><Skeleton className="mb-4 h-32 rounded-[18px]" /><Skeleton className="h-96 rounded-[18px]" /></div></div>;
  }

  if (!deal) {
    return <div className="flex h-full flex-col overflow-hidden"><CrmTopbar title="Deal not found" subtitle="This deal may have been deleted or you may not have access." actions={<Button variant="outline" onClick={() => router.push('/crm/pipeline')}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>} /></div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <CrmTopbar title={dealName} subtitle={`${stageLabels[deal.stage_slug] || deal.stage_slug || 'Deal'} • ${money(deal.requested_amount)} requested`} actions={<Button variant="outline" onClick={() => router.push('/crm/pipeline')}><ArrowLeft className="mr-2 h-4 w-4" />Pipeline</Button>} />
      <main className="flex-1 overflow-y-auto bg-[#F6F7FA] p-4 md:p-6">
        <div className="mb-5 rounded-[20px] border border-[#E4E4E7] bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Requested" value={money(deal.requested_amount)} />
            <Metric label="Approved" value={money(deal.approved_amount)} />
            <Metric label="Funded" value={money(deal.funded_amount)} />
            <Metric label="Last Activity" value={dateTime(lastActivity)} />
          </div>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto rounded-[16px] border border-[#E4E4E7] bg-white p-2">
          {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap rounded-[12px] px-3 py-2 text-sm font-medium ${activeTab === tab ? 'bg-[#0A1628] text-white' : 'text-[#52525B] hover:bg-[#F4F4F5]'}`}>{tabLabels[tab]}</button>)}
        </div>

        {activeTab === 'overview' && <Overview deal={deal} documents={documents} submissions={submissions} offers={offers} docStatusCounts={docStatusCounts} />}
        {activeTab === 'documents' && <DocumentsSection documents={documents} onUpload={() => setShowUpload(true)} onOpen={openDocument} onDelete={deleteDocument} canDelete={canDeleteDocuments} />}
        {activeTab === 'notes' && <section className="rounded-[18px] border border-[#E4E4E7] bg-white p-5"><SectionHeader title="Deal Notes" subtitle="Internal notes, lender updates, client updates, underwriting notes, and reminders live on this deal." action={<Button onClick={() => setShowNote(true)}><MessageSquarePlus className="mr-2 h-4 w-4" />Add Note</Button>} /><ActivityList activities={activities.filter((item) => item.activity_type === 'note')} empty="No notes yet." /></section>}
        {activeTab === 'lenders' && <LendersSection submissions={submissions} onAdd={() => setShowLender(true)} onStatusChange={updateLenderStatus} />}
        {activeTab === 'offers' && <OffersSection offers={offers} />}
        {activeTab === 'activity' && <section className="rounded-[18px] border border-[#E4E4E7] bg-white p-5"><h2 className="mb-5 text-lg font-semibold text-[#09090B]">Activity Timeline</h2><ActivityList activities={activities} empty="No activity yet." /></section>}
      </main>

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Document to Deal</DialogTitle><DialogDescription>This file will be attached directly to {dealName}, not uploaded as an unlinked document.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label htmlFor="deal_document_file">File *</Label><Input id="deal_document_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" onChange={(event) => setFile(event.target.files?.[0] || null)} />{file && <p className="mt-1 text-xs text-[#71717A]">{file.name} ({fileSize(file.size)})</p>}</div>
            <div><Label>Document Type</Label><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{documentTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="deal_document_notes">Notes</Label><Input id="deal_document_notes" value={documentNotes} onChange={(event) => setDocumentNotes(event.target.value)} placeholder="Optional document notes..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button><Button onClick={uploadDocument} disabled={saving || !file}>{saving ? 'Uploading…' : 'Upload to Deal'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNote} onOpenChange={setShowNote}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Deal Note</DialogTitle><DialogDescription>Save a note directly to this deal.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Note Type</Label><Select value={noteType} onValueChange={setNoteType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Internal note', 'Lender update', 'Client update', 'Underwriting note', 'Follow-up reminder'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="note_body">Note</Label><textarea id="note_body" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Add note details..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowNote(false)}>Cancel</Button><Button onClick={saveNote} disabled={saving || !noteBody.trim()}>{saving ? 'Saving…' : 'Save Note'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLender} onOpenChange={setShowLender}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Lender Submission</DialogTitle><DialogDescription>Record which lender this deal was sent to.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Lender</Label><Select value={partnerId} onValueChange={setPartnerId}><SelectTrigger><SelectValue placeholder="Select lender" /></SelectTrigger><SelectContent>{partners.map((partner) => <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Status</Label><Select value={submissionStatus} onValueChange={setSubmissionStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{submissionStatuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="submission_notes">Lender Notes</Label><textarea id="submission_notes" value={submissionNotes} onChange={(event) => setSubmissionNotes(event.target.value)} className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" placeholder="Submission notes, conditions, missing docs, lender response..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowLender(false)}>Cancel</Button><Button onClick={saveLender} disabled={saving || !partnerId}>{saving ? 'Saving…' : 'Add Lender'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold text-[#09090B]">{title}</h2><p className="text-sm text-[#71717A]">{subtitle}</p></div>{action}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-medium uppercase tracking-wide text-[#71717A]">{label}</div><div className="mt-1 text-2xl font-semibold text-[#09090B]">{value}</div></div>;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return <div><div className="text-xs font-medium uppercase tracking-wide text-[#A1A1AA]">{label}</div><div className="mt-1 text-sm font-semibold capitalize text-[#18181B]">{value || '—'}</div></div>;
}

function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="rounded-[16px] border border-dashed border-[#D4D4D8] py-12 text-center text-[#A1A1AA]"><div className="mx-auto mb-3 flex justify-center">{icon}</div><div className="font-semibold text-[#18181B]">{title}</div><p className="mx-auto mt-1 max-w-md text-sm text-[#71717A]">{description}</p></div>;
}

function Overview({ deal, documents, submissions, offers, docStatusCounts }: { deal: any; documents: any[]; submissions: any[]; offers: any[]; docStatusCounts: Record<string, number> }) {
  const dealName = deal?.businesses?.legal_name || deal?.businesses?.dba || deal?.title || 'Deal';
  return <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><section className="rounded-[18px] border border-[#E4E4E7] bg-white p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#09090B]"><Building2 className="h-5 w-5" /> Deal Summary</h2><div className="grid gap-4 md:grid-cols-2"><Info label="Business" value={dealName} /><Info label="Pipeline Stage" value={stageLabels[deal.stage_slug] || deal.stage_slug} /><Info label="Funding Probability" value={`${deal.funding_probability || 0}%`} /><Info label="Created" value={date(deal.created_at)} /><Info label="Application Status" value={deal.applications?.status || '—'} /><Info label="Use of Funds" value={deal.applications?.use_of_funds || '—'} /></div>{deal.notes && <div className="mt-5 rounded-[14px] bg-[#F8FAFC] p-4 text-sm text-[#3F3F46]"><span className="font-semibold">Deal notes:</span> {deal.notes}</div>}</section><section className="rounded-[18px] border border-[#E4E4E7] bg-white p-5"><h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#09090B]"><Calendar className="h-5 w-5" /> Deal Health</h2><div className="space-y-3"><SmallMetric label="Documents on deal" value={documents.length} /><SmallMetric label="Uploaded / Review" value={`${docStatusCounts.uploaded || 0} / ${docStatusCounts.in_review || 0}`} /><SmallMetric label="Lenders sent to" value={submissions.length} /><SmallMetric label="Offers received" value={offers.length} /></div></section></div>;
}

function SmallMetric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between rounded-[14px] bg-[#F8FAFC] px-4 py-3"><span className="text-sm text-[#71717A]">{label}</span><span className="text-sm font-semibold text-[#09090B]">{value}</span></div>;
}

function DocumentsSection({ documents, onUpload, onOpen, onDelete, canDelete }: { documents: any[]; onUpload: () => void; onOpen: (doc: any, disposition: 'preview' | 'download') => void; onDelete: (doc: any) => void; canDelete: boolean }) {
  return <section className="rounded-[18px] border border-[#E4E4E7] bg-white p-5"><SectionHeader title="Deal Documents" subtitle="All underwriting and lender documents for this deal are managed here on the deal itself." action={<Button onClick={onUpload}><Upload className="mr-2 h-4 w-4" />Upload to Deal</Button>} />{documents.length === 0 ? <EmptyState icon={<Upload className="h-10 w-10" />} title="No documents on this deal" description="Upload the application, bank statements, EIN letter, ID, voided check, contracts, and lender stip documents here." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{documents.map((doc) => <div key={doc.id} className="rounded-[16px] border border-[#E4E4E7] p-4"><div className="mb-3 flex items-start justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#EFF6FF] text-[#2563EB]">{fileIcon(doc.file_name)}</div><Badge variant="secondary">{docLabel(doc.document_type)}</Badge></div><div className="truncate text-sm font-semibold text-[#09090B]">{doc.file_name}</div><div className="mt-1 text-xs text-[#71717A]">{fileSize(doc.file_size)} • {date(doc.created_at)}</div><Badge className="mt-3 capitalize" variant="outline">{doc.status?.replaceAll('_', ' ')}</Badge>{doc.review_notes && <p className="mt-3 line-clamp-2 text-xs text-[#71717A]">{doc.review_notes}</p>}<div className="mt-4 flex gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={() => onOpen(doc, 'preview')}><Eye className="mr-1 h-3 w-3" />Preview</Button><Button size="sm" variant="outline" onClick={() => onOpen(doc, 'download')}><Download className="h-3 w-3" /></Button>{canDelete && <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => onDelete(doc)}><Trash2 className="h-3 w-3" /></Button>}</div></div>)}</div>}</section>;
}

function LendersSection({ submissions, onAdd, onStatusChange }: { submissions: any[]; onAdd: () => void; onStatusChange: (submission: any, status: string) => void }) {
  return <section className="rounded-[18px] border border-[#E4E4E7] bg-white p-5"><SectionHeader title="Lenders Sent To" subtitle="Track every lender this deal has been sent to and their current status." action={<Button onClick={onAdd}><Send className="mr-2 h-4 w-4" />Add Lender</Button>} />{submissions.length === 0 ? <EmptyState icon={<Landmark className="h-10 w-10" />} title="No lender submissions yet" description="Add the lenders this deal has been sent to so the team can see deal distribution instantly." /> : <div className="overflow-x-auto rounded-[14px] border border-[#E4E4E7]"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#F8FAFC] text-xs uppercase tracking-wide text-[#71717A]"><tr><th className="px-4 py-3">Lender</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Sent</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Notes</th></tr></thead><tbody className="divide-y divide-[#E4E4E7]">{submissions.map((submission) => <tr key={submission.id}><td className="px-4 py-3 font-medium text-[#09090B]">{submission.funding_partners?.name || 'Unknown lender'}</td><td className="px-4 py-3"><Select value={submission.status} onValueChange={(value) => onStatusChange(submission, value)}><SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{submissionStatuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></td><td className="px-4 py-3 text-[#71717A]">{date(submission.submitted_at)}</td><td className="px-4 py-3 text-[#71717A]">{date(submission.updated_at)}</td><td className="px-4 py-3 text-[#71717A]">{submission.notes || submission.decline_reason || '—'}</td></tr>)}</tbody></table></div>}</section>;
}

function OffersSection({ offers }: { offers: any[] }) {
  return <section className="rounded-[18px] border border-[#E4E4E7] bg-white p-5"><h2 className="mb-5 text-lg font-semibold text-[#09090B]">Offers</h2>{offers.length === 0 ? <EmptyState icon={<DollarSign className="h-10 w-10" />} title="No offers received yet" description="Recorded lender offers for this deal will appear here." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{offers.map((offer) => <div key={offer.id} className="rounded-[16px] border border-[#E4E4E7] p-4"><div className="mb-2 flex items-start justify-between gap-3"><div><div className="text-xs text-[#71717A]">{offer.funding_partners?.name || 'Lender offer'}</div><div className="text-2xl font-semibold text-[#09090B]">{money(offer.approved_amount)}</div></div><Badge variant="secondary" className="capitalize">{offer.status}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Info label="Factor Rate" value={offer.factor_rate || '—'} /><Info label="Term" value={offer.term_days ? `${offer.term_days} days` : '—'} /><Info label="Frequency" value={offer.payment_frequency?.replaceAll('_', ' ') || '—'} /><Info label="Expires" value={date(offer.expires_at)} /><Info label="Payback" value={money(offer.payback_amount)} /><Info label="Payment" value={money(offer.daily_payment || offer.weekly_payment)} /></div>{offer.notes && <p className="mt-4 text-sm text-[#71717A]">{offer.notes}</p>}</div>)}</div>}</section>;
}

function ActivityList({ activities, empty }: { activities: any[]; empty: string }) {
  if (activities.length === 0) return <EmptyState icon={<FileText className="h-10 w-10" />} title={empty} description="Deal notes, document events, lender submissions, lender status changes, and offer activity will appear here." />;
  return <div className="space-y-3">{activities.map((activity) => <div key={activity.id} className="rounded-[14px] border border-[#E4E4E7] p-4"><div className="mb-1 flex items-start justify-between gap-3"><div className="font-semibold text-[#09090B]">{activity.title}</div><Badge variant="outline" className="capitalize">{activity.activity_type?.replaceAll('_', ' ')}</Badge></div>{activity.body && <p className="text-sm text-[#52525B]">{activity.body}</p>}<div className="mt-2 text-xs text-[#A1A1AA]">{dateTime(activity.created_at)}</div></div>)}</div>;
}
