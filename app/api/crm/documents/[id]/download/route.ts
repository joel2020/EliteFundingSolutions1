import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();

function contentDispositionFilename(fileName: string) {
  const safeName = fileName.replace(/[\r\n"]/g, '_') || 'document';
  return `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const parsedId = idSchema.safeParse(params.id);
  if (!parsedId.success) {
    return NextResponse.json({ success: false, error: 'Invalid document id.' }, { status: 400 });
  }

  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('id,organization_id,file_name,mime_type,storage_path,status,visibility')
    .eq('id', parsedId.data)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (documentError) {
    return NextResponse.json({ success: false, error: documentError.message }, { status: 500 });
  }
  if (!document || !document.storage_path) {
    return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 });
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from('application-documents')
    .download(document.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json({ success: false, error: downloadError?.message || 'Unable to download document.' }, { status: 404 });
  }

  const fileBuffer = Buffer.from(await fileData.arrayBuffer());
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': document.mime_type || 'application/octet-stream',
      'Content-Length': String(fileBuffer.length),
      'Content-Disposition': contentDispositionFilename(document.file_name || 'document'),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
