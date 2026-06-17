import { NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Optional applicant upload of recent business bank statements during the public application.
// Capability-scoped to a valid application UUID + same-origin, with type/size/count caps.
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 6;
const MAX_TOTAL_BANK_STATEMENTS = 8;

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

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ success: false, error: 'Invalid upload payload.' }, { status: 400 });
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return NextResponse.json({ success: true, uploaded: 0 });
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json({ success: false, error: `Upload up to ${MAX_FILES_PER_REQUEST} statements at a time.` }, { status: 400 });
  }

  const { count: existingCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', application.organization_id)
    .eq('application_id', application.id)
    .eq('document_type', 'bank_statement');
  let remaining = Math.max(0, MAX_TOTAL_BANK_STATEMENTS - Number(existingCount || 0));

  let uploaded = 0;
  for (const file of files) {
    if (remaining <= 0) break;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (file.size > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(file.type) && !allowedExtensions.has(extension))) continue;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${application.organization_id}/${deal?.id || application.id}/bank-statements/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('application-documents')
      .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (uploadError) continue;
    const { error: documentError } = await supabase.from('documents').insert({
      organization_id: application.organization_id,
      deal_id: deal?.id || null,
      application_id: application.id,
      document_type: 'bank_statement',
      label: 'Bank statement (applicant upload)',
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      storage_path: storagePath,
      status: 'uploaded',
      visibility: 'internal',
    });
    if (documentError) {
      await supabase.storage.from('application-documents').remove([storagePath]).catch(() => null);
      continue;
    }
    uploaded += 1;
    remaining -= 1;
  }

  return NextResponse.json({ success: true, uploaded });
}
