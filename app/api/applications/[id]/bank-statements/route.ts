import { NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Optional applicant upload of recent business bank statements during the public application.
// Capability-scoped to a valid application UUID + same-origin, with type/size/count caps.
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 8;
const MAX_TOTAL_PER_TYPE = 12;
const ALLOWED_DOC_TYPES = new Set(['bank_statement', 'drivers_license', 'tax_document', 'ar_report', 'other']);
const DOC_TYPE_LABELS: Record<string, string> = {
  bank_statement: 'Bank statement (applicant upload)',
  drivers_license: "Driver's license (applicant upload)",
  tax_document: 'Tax document (applicant upload)',
  ar_report: 'A/R report (applicant upload)',
  other: 'Supporting document (applicant upload)',
};

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const supabase = createServiceSupabaseClient();

  const { data: application } = await supabase
    .from('applications')
    .select('id,organization_id,business_id')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!application) return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });

  const { data: deal } = await supabase
    .from('deals')
    .select('id')
    .eq('application_id', application.id)
    .eq('organization_id', application.organization_id)
    .is('deleted_at', null)
    .maybeSingle();

  // Two intake shapes, both capped identically:
  // - JSON finalize (preferred): the browser already PUT the file bytes straight to Supabase
  //   Storage via a signed upload URL (see ./upload-url), bypassing the serverless
  //   request-body limit. The body lists the uploaded storage paths to register.
  // - Legacy multipart: raw file bytes posted here (subject to the ~4.5MB platform limit).
  const expectedPrefix = `${application.organization_id}/${deal?.id || application.id}/bank-statements/`;
  const contentType = request.headers.get('content-type') || '';
  type IncomingFile = { name: string; size: number; mimeType: string; storagePath: string | null; file: File | null };
  let requestedType = 'bank_statement';
  let incoming: IncomingFile[] = [];

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ success: false, error: 'Invalid upload payload.' }, { status: 400 });
    requestedType = String(body.document_type || 'bank_statement');
    incoming = (Array.isArray(body.files) ? body.files : [])
      .map((f: any) => ({
        name: String(f?.file_name || '').trim(),
        size: Number(f?.file_size || 0),
        mimeType: String(f?.mime_type || '').trim(),
        storagePath: String(f?.storage_path || '').trim() || null,
        file: null,
      }))
      // Only accept paths this application's upload-url route could have minted.
      .filter((f: IncomingFile) => f.name && f.size > 0 && f.storagePath && f.storagePath.startsWith(expectedPrefix));
  } else {
    const formData = await request.formData().catch(() => null);
    if (!formData) return NextResponse.json({ success: false, error: 'Invalid upload payload.' }, { status: 400 });
    requestedType = String(formData.get('document_type') || 'bank_statement');
    incoming = formData.getAll('files')
      .filter((f): f is File => f instanceof File && f.size > 0)
      .map((file) => ({ name: file.name, size: file.size, mimeType: file.type || '', storagePath: null, file }));
  }

  const documentType = ALLOWED_DOC_TYPES.has(requestedType) ? requestedType : 'bank_statement';
  const documentLabel = DOC_TYPE_LABELS[documentType] || DOC_TYPE_LABELS.other;
  if (!incoming.length) return NextResponse.json({ success: true, uploaded: 0 });
  if (incoming.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json({ success: false, error: `Upload up to ${MAX_FILES_PER_REQUEST} files at a time.` }, { status: 400 });
  }

  const { count: existingCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', application.organization_id)
    .eq('application_id', application.id)
    .eq('document_type', documentType);
  let remaining = Math.max(0, MAX_TOTAL_PER_TYPE - Number(existingCount || 0));

  let uploaded = 0;
  for (const entry of incoming) {
    if (remaining <= 0) break;
    const extension = entry.name.split('.').pop()?.toLowerCase() || '';
    if (entry.size > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(entry.mimeType) && !allowedExtensions.has(extension))) continue;

    let storagePath = entry.storagePath;
    if (storagePath) {
      // Direct-upload path: confirm the object actually exists in storage before registering it.
      const folder = storagePath.slice(0, storagePath.lastIndexOf('/'));
      const objectName = storagePath.slice(storagePath.lastIndexOf('/') + 1);
      const { data: found } = await supabase.storage.from('application-documents').list(folder, { search: objectName, limit: 1 });
      if (!found?.some((item: any) => item.name === objectName)) continue;
    } else if (entry.file) {
      const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      storagePath = `${expectedPrefix}${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('application-documents')
        .upload(storagePath, entry.file, { contentType: entry.mimeType || 'application/octet-stream', upsert: false });
      if (uploadError) continue;
    } else {
      continue;
    }

    const { error: documentError } = await supabase.from('documents').insert({
      organization_id: application.organization_id,
      deal_id: deal?.id || null,
      application_id: application.id,
      document_type: documentType,
      label: documentLabel,
      file_name: entry.name,
      file_size: entry.size,
      mime_type: entry.mimeType || null,
      storage_path: storagePath,
      status: 'uploaded',
      visibility: 'internal',
    });
    if (documentError) {
      if (!entry.storagePath) await supabase.storage.from('application-documents').remove([storagePath]).catch(() => null);
      continue;
    }
    uploaded += 1;
    remaining -= 1;
  }

  return NextResponse.json({ success: true, uploaded });
}
