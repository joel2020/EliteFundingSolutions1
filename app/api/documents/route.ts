import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ success: false, error: 'Invalid document payload.' }, { status: 400 });

  const file = formData.get('file');
  const documentType = String(formData.get('document_type') || 'other');
  const label = String(formData.get('label') || documentType.replaceAll('_', ' '));
  const reviewNotes = String(formData.get('review_notes') || '').trim();
  if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ success: false, error: 'Document file is required.' }, { status: 400 });

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.size > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(file.type) && !allowedExtensions.has(extension))) {
    return NextResponse.json({ success: false, error: 'Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.' }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${profile.organization_id}/global/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from('application-documents')
    .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploadError) return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });

  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      organization_id: profile.organization_id,
      document_type: documentType,
      file_name: file.name,
      label,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || null,
      review_notes: reviewNotes || null,
      uploaded_by_user_id: user.id,
      status: 'uploaded',
    })
    .select('id')
    .single();

  if (docError) return NextResponse.json({ success: false, error: docError.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'document_uploaded',
    resource_type: 'documents',
    resource_id: document.id,
    new_data: { file_name: file.name, document_type: documentType },
  });

  return NextResponse.json({ success: true, documentId: document.id });
}
