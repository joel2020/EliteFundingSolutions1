import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmAccess, requireSameOrigin } from '@/lib/server-auth';
import { isInternalCrmRole, isIsoPartnerRole } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

// Same access rules as POST /api/crm/deals/[id]/documents.
const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'iso_broker', 'broker', 'referral_partner'];
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const bodySchema = z.object({
  file_name: z.string().trim().min(1),
  mime_type: z.string().trim().optional().default(''),
  file_size: z.coerce.number().int().positive(),
});

// Step 1 of the direct-to-storage upload flow: mint a short-lived, path-scoped signed
// upload URL so the browser can PUT the file bytes straight to Supabase Storage,
// bypassing the ~4.5MB request-body limit on Vercel serverless functions. The file
// never passes through this (or any) API route.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmAccess(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid upload request.' }, { status: 400 });
  const { file_name, mime_type, file_size } = parsed.data;

  const extension = file_name.split('.').pop()?.toLowerCase() || '';
  if (file_size > MAX_FILE_SIZE_BYTES || (!allowedTypes.has(mime_type) && !allowedExtensions.has(extension))) {
    return NextResponse.json({ success: false, error: 'Documents must be PDF, JPG, PNG, or HEIC files up to 10MB.' }, { status: 400 });
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,iso_broker_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();
  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  if (!isInternalCrmRole(profile.role)) {
    const canUploadAsIso = isIsoPartnerRole(profile.role) && profile.access_entity_id && deal.iso_broker_id === profile.access_entity_id;
    if (!canUploadAsIso) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${profile.organization_id}/${deal.id}/${Date.now()}-${safeName}`;

  const { data: signed, error } = await supabase.storage.from('application-documents').createSignedUploadUrl(storagePath);
  if (error || !signed) return NextResponse.json({ success: false, error: error?.message || 'Could not create upload URL.' }, { status: 500 });

  return NextResponse.json({ success: true, path: signed.path, token: signed.token, storagePath });
}
