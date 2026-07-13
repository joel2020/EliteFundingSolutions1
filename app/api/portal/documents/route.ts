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

  // Two intake shapes:
  // - JSON finalize (preferred): the browser already PUT the file bytes straight to Supabase
  //   Storage via a signed upload URL (see ./upload-url), bypassing the serverless
  //   request-body limit. The body carries the storage path to register.
  // - Legacy multipart: raw file bytes posted here (subject to the ~4.5MB platform limit).
  const contentType = request.headers.get('content-type') || '';
  let applicationId = '';
  let fileName = '';
  let fileSize = 0;
  let mimeType = '';
  let claimedStoragePath: string | null = null;
  let file: File | null = null;

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ success: false, error: 'Invalid upload payload.' }, { status: 400 });
    applicationId = String(body.application_id || '');
    fileName = String(body.file_name || '').trim();
    fileSize = Number(body.file_size || 0);
    mimeType = String(body.mime_type || '').trim();
    claimedStoragePath = String(body.storage_path || '').trim() || null;
    if (!applicationId || !fileName || !(fileSize > 0) || !claimedStoragePath) {
      return NextResponse.json({ success: false, error: 'Application and file are required.' }, { status: 400 });
    }
  } else {
    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({ success: false, error: 'Invalid upload payload.' }, { status: 400 });
    applicationId = String(formData.get('application_id') || '');
    const formFile = formData.get('file');
    if (!applicationId || !(formFile instanceof File) || formFile.size <= 0) {
      return NextResponse.json({ success: false, error: 'Application and file are required.' }, { status: 400 });
    }
    file = formFile;
    fileName = formFile.name;
    fileSize = formFile.size;
    mimeType = formFile.type || '';
  }

  const applicationIds = await getPortalApplicationIds(supabase, user, profile.organization_id, profile);
  if (!applicationIds.includes(applicationId)) {
    return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
  }

  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (fileSize > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(mimeType) && !allowedExtensions.has(extension))) {
    return NextResponse.json({ success: false, error: 'Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.' }, { status: 400 });
  }

  const { data: application } = await supabase
    .from('applications')
    .select('id,business_id,lead_id')
    .eq('id', applicationId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!application) return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });

  const expectedPrefix = `${profile.organization_id}/${applicationId}/client_uploads/`;
  let storagePath: string;
  if (claimedStoragePath) {
    // Direct-upload path: only accept paths our upload-url route could have minted for this
    // application, and confirm the object actually exists in storage before registering it.
    if (!claimedStoragePath.startsWith(expectedPrefix)) {
      return NextResponse.json({ success: false, error: 'Invalid upload path.' }, { status: 400 });
    }
    const folder = claimedStoragePath.slice(0, claimedStoragePath.lastIndexOf('/'));
    const objectName = claimedStoragePath.slice(claimedStoragePath.lastIndexOf('/') + 1);
    const { data: found } = await supabase.storage.from('application-documents').list(folder, { search: objectName, limit: 1 });
    if (!found?.some((item: any) => item.name === objectName)) {
      return NextResponse.json({ success: false, error: 'Uploaded file not found in storage.' }, { status: 400 });
    }
    storagePath = claimedStoragePath;
  } else {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    storagePath = `${expectedPrefix}${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('application-documents')
      .upload(storagePath, file as File, { contentType: mimeType || 'application/octet-stream', upsert: false });

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }
  }

  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
      organization_id: profile.organization_id,
      application_id: applicationId,
      document_type: 'other',
      label: 'Client Portal Upload',
      file_name: fileName,
      storage_path: storagePath,
      file_size: fileSize,
      mime_type: mimeType || null,
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
      body: fileName,
      direction: 'inbound',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'portal_document_uploaded',
      resource_type: 'documents',
      resource_id: document.id,
      new_data: { application_id: applicationId, file_name: fileName },
    }),
  ]);

  return NextResponse.json({ success: true, document });
}
