'use client';

import { useEffect, useState } from 'react';
import { CrmTopbar } from '@/components/crm/topbar';
import { supabase, DEFAULT_ORG_ID } from '@/lib/supabase';
import { Upload, FileText, Download, Trash2, File, Image as ImageIcon, FileArchive } from 'lucide-react';
import type { Document } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const docTypes = [
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'tax_return', label: 'Tax Return' },
  { value: 'voided_check', label: 'Voided Check' },
  { value: 'drivers_license', label: 'Driver\'s License' },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other' },
];

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="w-5 h-5" />;
  if (['pdf'].includes(ext || '')) return <FileText className="w-5 h-5" />;
  if (['zip', 'rar'].includes(ext || '')) return <FileArchive className="w-5 h-5" />;
  return <File className="w-5 h-5" />;
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('bank_statement');
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('organization_id', DEFAULT_ORG_ID)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load documents');
      console.error(error);
    } else if (data) {
      setDocuments(data as Document[]);
    }
    setLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const uploadDocument = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${DEFAULT_ORG_ID}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Save document record
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          organization_id: DEFAULT_ORG_ID,
          document_type: docType,
          file_name: file.name,
          file_path: filePath,
          file_url: publicUrl,
          file_size: file.size,
          description: description || null,
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

  const downloadDocument = async (doc: Document) => {
    if (!doc.file_url) {
      toast.error('File URL not available');
      return;
    }
    window.open(doc.file_url, '_blank');
  };

  const deleteDocument = async (doc: Document) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    // Delete from storage
    if (doc.file_path) {
      await supabase.storage
        .from('documents')
        .remove([doc.file_path]);
    }

    // Delete from database
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id);

    if (error) {
      toast.error('Failed to delete document');
    } else {
      toast.success('Document deleted');
      loadDocuments();
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <CrmTopbar
        title="Documents"
        subtitle={`${documents.length} documents`}
        actions={
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12 text-[#A1A1AA]">Loading…</div>
          ) : documents.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Upload className="w-12 h-12 mx-auto mb-4 text-[#A1A1AA]" />
              <p className="text-[#71717A] mb-4">No documents uploaded yet</p>
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Your First Document
              </Button>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-[#E4E4E7] rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
                      {getFileIcon(doc.file_name)}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {docTypes.find(t => t.value === doc.document_type)?.label || doc.document_type}
                  </Badge>
                </div>

                <div className="mb-3">
                  <div className="font-medium text-sm text-[#09090B] truncate mb-1">
                    {doc.file_name}
                  </div>
                  {doc.description && (
                    <div className="text-xs text-[#71717A] line-clamp-2">
                      {doc.description}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-[#A1A1AA] mb-3">
                  <span>{formatFileSize(doc.file_size)}</span>
                  <span>{new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => downloadDocument(doc)}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteDocument(doc)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a new document to your CRM
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="file">File *</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              />
              {file && (
                <p className="text-xs text-[#71717A] mt-1">
                  Selected: {file.name} ({formatFileSize(file.size)})
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="doc_type">Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {docTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={uploadDocument} disabled={uploading || !file}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
