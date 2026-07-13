import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceSupabaseClient } from '@/lib/server-supabase';
import { requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Step 1 of the applicant direct-to-storage upload: mint a short-lived, path-scoped signed
// upload URL so the browser PUTs the file bytes straight to Supabase Storage, bypassing the
// ~4.5MB request-body limit on Vercel serverless functions. Capability-scoped the same way
// as the bank-statements upload route: valid application UUID + same-origin.
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const bodySchema = z.object({
  file_name: z.string().trim().min(1),
  mime_type: z.string().trim().optional().default(''),
  file_size: z.coerce.number().int().positive(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid upload request.' }, { status: 400 });
  const { file_name, mime_type, file_size } = parsed.data;

  const extension = file_name.split('.').pop()?.toLowerCase() || '';
  if (file_size > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(mime_type) && !allowedExtensions.has(extension))) {
    return NextResponse.json({ success: false, error: 'Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.' }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: application } = await supabase
    .from('applications')
    .select('id,organization_id')
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

  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${application.organization_id}/${deal?.id || application.id}/bank-statements/${Date.now()}-${safeName}`;

  const { data: signed, error } = await supabase.storage.from('application-documents').createSignedUploadUrl(storagePath);
  if (error || !signed) return NextResponse.json({ success: false, error: error?.message || 'Could not create upload URL.' }, { status: 500 });

  return NextResponse.json({ success: true, path: signed.path, token: signed.token, storagePath });
}
