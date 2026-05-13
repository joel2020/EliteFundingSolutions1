import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createServiceSupabaseClient } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() { /* route does not mutate auth cookies */ },
    },
  });
  const { data: { session } } = await authClient.auth.getSession();
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceSupabaseClient();
  const { data: profile } = await supabase.from('user_profiles').select('organization_id, role').eq('user_id', session.user.id).eq('is_active', true).single();
  if (!profile) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

  const { data: doc, error } = await supabase.from('documents').select('id, organization_id, storage_path, file_name').eq('id', params.id).single();
  if (error || !doc || doc.organization_id !== profile.organization_id) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { data, error: signedError } = await supabase.storage.from('application-documents').createSignedUrl(doc.storage_path, 120, { download: doc.file_name });
  if (signedError || !data?.signedUrl) return NextResponse.json({ success: false, error: 'Unable to open document.' }, { status: 500 });

  await supabase.from('audit_logs').insert({ organization_id: profile.organization_id, user_id: session.user.id, action: 'document_signed_url_created', resource_type: 'documents', resource_id: doc.id, metadata: { file_name: doc.file_name } });
  return NextResponse.json({ success: true, url: data.signedUrl });
}
