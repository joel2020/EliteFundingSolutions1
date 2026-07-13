import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPortalApplicationIds, requirePortalProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Step 1 of the portal direct-to-storage upload: mint a short-lived, path-scoped signed
// upload URL so the browser PUTs the file bytes straight to Supabase Storage, bypassing
// the ~4.5MB request-body limit on Vercel serverless functions.
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const bodySchema = z.object({
  application_id: z.string().uuid(),
  file_name: z.string().trim().min(1),
  mime_type: z.string().trim().optional().default(''),
  file_size: z.coerce.number().int().positive(),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requirePortalProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid upload request.' }, { status: 400 });
  const { application_id, file_name, mime_type, file_size } = parsed.data;

  const extension = file_name.split('.').pop()?.toLowerCase() || '';
  if (file_size > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(mime_type) && !allowedExtensions.has(extension))) {
    return NextResponse.json({ success: false, error: 'Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.' }, { status: 400 });
  }

  const applicationIds = await getPortalApplicationIds(supabase, user, profile.organization_id, profile);
  if (!applicationIds.includes(application_id)) {
    return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
  }

  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${profile.organization_id}/${application_id}/client_uploads/${Date.now()}-${safeName}`;

  const { data: signed, error } = await supabase.storage.from('application-documents').createSignedUploadUrl(storagePath);
  if (error || !signed) return NextResponse.json({ success: false, error: error?.message || 'Could not create upload URL.' }, { status: 500 });

  return NextResponse.json({ success: true, path: signed.path, token: signed.token, storagePath });
}
