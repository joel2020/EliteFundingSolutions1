'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase } from '@/lib/supabase';
import { useCrmUser } from '@/lib/crm-auth';
import { Upload, FileText, Download, Trash2, File, Image as ImageIcon, FileArchive, Eye, Search, Filter } from 'lucide-react';
import type { Document } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const docTypes = [
  { value: 'bank_statement', aliases: ['bank_statements'], label: 'Bank Statement' },
  { value: 'tax_return', aliases: ['tax_returns'], label: 'Tax Return' },
  { value: 'voided_check', aliases: [], label: 'Voided Check' },
  { value: 'drivers_license', aliases: ['driver_license', 'government_id'], label: 'Driver\'s License' },
  { value: 'proof_of_address', aliases: [], label: 'Proof of Address' },
  { value: 'contract', aliases: ['contracts'], label: 'Contract' },
  { value: 'other', aliases: [], label: 'Other' },
];

function normalizeDocType(type: string) {
  const match = docTypes.find((item) => item.value === type || item.aliases.includes(type));
  return match?.value || type;
}

function docTypeLabel(type: string) {
  const normalized = normalizeDocType(type);
  return docTypes.find((item) => item.value === normalized)?.label || normalized.replaceAll('_', ' ');
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext || '')) return <ImageIcon className="w-5 h-5" />;
  if (['pdf'].includes(ext || '')) return <FileText className="w-5 h-5" />;
  if (['zip', 'rar'].includes(ext || '')) return <FileArchive className="w-5 h-5" />;
  return <File className="w-5 h-5" />;
};

type CrmDocument = Document & {
  applications?: any;
  deals?: any;
};

export default function DocumentsPage() {
  const { organizationId, profile, loading: crmUserLoading, error: crmUserError } = useCrmUser();
  const [documents, setDocuments] = useState<CrmDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('bank_statement');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadDocuments = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('id,organization_id,deal_id,application_id,document_type,label,file_name,file_size,mime_type,storage_path,status,review_notes,created_at,updated_at,applications(id,businesses(legal_name,dba)),deals(id,title,businesses(legal_name,dba))')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      toast.error('Failed to load documents');
      console.error(error);
    } else if (data) {
      setDocuments(data as unknown as CrmDocument[]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (crmUserLoading) return;
    if (!organizationId) { toast.error(crmUserError || 'Your CRM profile is not active.'); setLoading(false); return; }
    loadDocuments();
  }, [crmUserLoading, organizationId, crmUserError, loadDocuments]);

  const filteredDocuments = useMemo(() => documents.filter((doc) => {
    const business = doc.applications?.businesses?.legal_name || doc.deals?.businesses?.legal_name || doc.applications?.businesses?.dba || doc.deals?.businesses?.dba || '';
    const q = search.toLowerCase();
    return (!q || doc.file_name.toLowerCase().includes(q) || doc.label.toLowerCase().includes(q) || business.toLowerCase().includes(q))
      && (typeFilter === 'all' || normalizeDocType(doc.document_type) === typeFilter)
      && (statusFilter === 'all' || doc.status === statusFilter);
  }), [documents, search, typeFilter, statusFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const uploadDocument = async () => {
    if (!organizationId) { toast.error('Your CRM profile is not active.'); return; }
    if (!file) { toast.error('Please select a file'); return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'];
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (file.size > 10 * 1024 * 1024 || (!allowed.includes(file.type) && !['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif'].includes(extension || ''))) {
      toast.error('Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${organizationId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('application-documents').upload(filePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;

      const normalizedType = normalizeDocType(docType);
      const { error: dbError } = await supabase.from('documents').insert({
        organization_id: organizationId,
        document_type: normalizedType,
        file_name: file.name,
        label: docTypeLabel(normalizedType),
        storage_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        review_notes: description || null,
      });
      if (dbError) throw dbError;

      toast.success('Document uploaded successfully');
      setShowUploadDialog(false);
      setFile(null);
      setDescription('');
      loadDocuments();
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
      console.error(error);
    }
    setUploading(false);
  };

  const openDocument = async (doc: CrmDocument, disposition: 'preview' | 'download') => {
    const response = await fetch(`/api/documents/${doc.id}/signed-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ disposition }) });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Unable to open document'); return; }
    window.open(result.url, '_blank', 'noopener,noreferrer');
  };

  const deleteDocument = async (doc: CrmDocument) => {
    if (!confirm('Delete this document? The file will be removed from private storage and the action will be audit logged.')) return;
    const response = await fetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.success) { toast.error(result.error || 'Failed to delete document'); return; }
    toast.success('Document deleted');
    loadDocuments();
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar title="Documents" subtitle={`${filteredDocuments.length} documents`} actions={<Button onClick={() => setShowUploadDialog(true)}><Upload className="w-4 h-4 mr-2" />Upload Document</Button>} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F6F7FA]">
        <div className="mb-5 grid grid-cols-1 md:grid-cols-[1fr_220px_180px] gap-3 rounded-[16px] border border-[#E4E4E7] bg-white p-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A1A1AA]" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search file, label, business…" className="pl-9" /></div>
          <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Document type" /></SelectTrigger><SelectContent><SelectItem value="all">All document types</SelectItem>{docTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="uploaded">Uploaded</SelectItem><SelectItem value="in_review">In Review</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem><SelectItem value="needs_replacement">Needs Replacement</SelectItem></SelectContent></Select>
        </div>

        {loading ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-56 rounded-[16px]" />)}</div> : filteredDocuments.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#D4D4D8] bg-white text-center py-16"><Upload className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" /><p className="font-semibold text-[#0A1628]">No documents found</p><p className="text-sm text-[#71717A] mb-4">Upload private merchant documents or clear filters.</p><Button onClick={() => setShowUploadDialog(true)}><Upload className="w-4 h-4 mr-2" />Upload Document</Button></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">{filteredDocuments.map((doc) => {
            const business = doc.applications?.businesses?.legal_name || doc.deals?.businesses?.legal_name || doc.applications?.businesses?.dba || doc.deals?.businesses?.dba;
            return <div key={doc.id} className="bg-white border border-[#E4E4E7] rounded-[16px] p-4 hover:shadow-[0_14px_40px_rgba(6,13,27,0.08)] transition-shadow"><div className="flex items-start justify-between mb-3"><div className="w-11 h-11 rounded-[12px] bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">{getFileIcon(doc.file_name)}</div><Badge variant="secondary" className="text-xs">{docTypeLabel(doc.document_type)}</Badge></div><div className="mb-3"><div className="font-semibold text-sm text-[#09090B] truncate mb-1">{doc.file_name}</div><div className="text-xs text-[#71717A]">{business || 'Unlinked document'}</div>{doc.review_notes && <div className="text-xs text-[#71717A] line-clamp-2 mt-1">{doc.review_notes}</div>}</div><div className="flex items-center justify-between text-xs text-[#A1A1AA] mb-3"><span>{formatFileSize(doc.file_size)}</span><span>{new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" className="flex-1" onClick={() => openDocument(doc, 'preview')}><Eye className="w-3 h-3 mr-1" />Preview</Button><Button size="sm" variant="outline" onClick={() => openDocument(doc, 'download')}><Download className="w-3 h-3" /></Button>{['super_admin', 'admin', 'manager', 'processor'].includes(profile?.role || '') && <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => deleteDocument(doc)}><Trash2 className="w-3 h-3" /></Button>}</div></div>;
          })}</div>
        )}
      </div>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent><DialogHeader><DialogTitle>Upload Document</DialogTitle><DialogDescription>Upload a PDF or image to the private application-documents bucket. Access uses short-lived signed URLs only.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div><Label htmlFor="file">File *</Label><Input id="file" type="file" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" />{file && <p className="text-xs text-[#71717A] mt-1">Selected: {file.name} ({formatFileSize(file.size)})</p>}</div><div><Label htmlFor="doc_type">Document Type</Label><Select value={docType} onValueChange={setDocType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{docTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-[#71717A]">Public application uploads named bank_statements are normalized to Bank Statement in CRM.</p></div><div><Label htmlFor="description">Description (Optional)</Label><Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description…" /></div></div><DialogFooter><Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button><Button onClick={uploadDocument} disabled={uploading || !file}>{uploading ? 'Uploading...' : 'Upload'}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
