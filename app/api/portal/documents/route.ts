import { NextResponse } from 'next/server';
import { getPortalApplicationIds, requirePortalProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requirePortalProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ success: false, error: 'Invalid upload payload.' }, { status: 400 });

  const applicationId = String(formData.get('application_id') || '');
  const file = formData.get('file');
  if (!applicationId || !(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ success: false, error: 'Application and file are required.' }, { status: 400 });
  }

  const applicationIds = await getPortalApplicationIds(supabase, user, profile.organization_id);
  if (!applicationIds.includes(applicationId)) {
    return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.size > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(file.type) && !allowedExtensions.has(extension))) {
    return NextResponse.json({ success: false, error: 'Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.' }, { status: 400 });
  }

  const { data: application } = await supabase
    .from('applications')
    .select('id,business_id,lead_id')
    .eq('id', applicationId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!application) return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${profile.organization_id}/${applicationId}/client_uploads/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from('application-documents')
    .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });

  if (uploadError) {
    return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
  }

  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      organization_id: profile.organization_id,
      application_id: applicationId,
      document_type: 'other',
      label: 'Client Portal Upload',
      file_name: file.name,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.type || null,
      status: 'uploaded',
      uploaded_by_user_id: user.id,
    })
    .select('id,application_id,label,file_name,status,created_at')
    .single();

  if (docError) {
    return NextResponse.json({ success: false, error: docError.message }, { status: 500 });
  }

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      application_id: applicationId,
      business_id: application.business_id,
      lead_id: application.lead_id,
      activity_type: 'document_event',
      title: 'Client uploaded document',
      body: file.name,
      direction: 'inbound',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'portal_document_uploaded',
      resource_type: 'documents',
      resource_id: document.id,
      new_data: { application_id: applicationId, file_name: file.name },
    }),
  ]);

  return NextResponse.json({ success: true, document });
}
