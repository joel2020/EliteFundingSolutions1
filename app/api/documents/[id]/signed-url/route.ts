import { NextResponse } from 'next/server';
import { INTERNAL_CRM_ROLES, requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(INTERNAL_CRM_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, organization_id, storage_path, file_name')
    .eq('id', (await params).id)
    .single();

  if (error || !doc || doc.organization_id !== profile.organization_id) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const isDownload = body?.disposition === 'download';
  const { data, error: signedError } = await supabase.storage
    .from('application-documents')
    .createSignedUrl(doc.storage_path, 120, isDownload ? { download: doc.file_name } : undefined);

  if (signedError || !data?.signedUrl) return NextResponse.json({ success: false, error: 'Unable to open document.' }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: isDownload ? 'document_download_signed_url_created' : 'document_preview_signed_url_created',
    resource_type: 'documents',
    resource_id: doc.id,
    new_data: { file_name: doc.file_name, expires_in_seconds: 120 },
  });

  return NextResponse.json({ success: true, url: data.signedUrl });
}
