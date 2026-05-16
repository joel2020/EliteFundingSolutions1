import { NextResponse } from 'next/server';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const DELETE_ROLES = ['super_admin', 'admin', 'manager', 'processor'];

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCrmProfile(DELETE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, organization_id, storage_path, file_name, document_type, application_id, deal_id')
    .eq('id', params.id)
    .single();

  if (error || !doc || doc.organization_id !== profile.organization_id) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const { error: storageError } = await supabase.storage.from('application-documents').remove([doc.storage_path]);
  if (storageError) return NextResponse.json({ success: false, error: 'Unable to delete private file.' }, { status: 500 });

  const { error: deleteError } = await supabase.from('documents').delete().eq('id', doc.id).eq('organization_id', profile.organization_id);
  if (deleteError) return NextResponse.json({ success: false, error: 'Unable to delete document record.' }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'document_deleted',
    resource_type: 'documents',
    resource_id: doc.id,
    old_data: doc,
  });

  return NextResponse.json({ success: true });
}
