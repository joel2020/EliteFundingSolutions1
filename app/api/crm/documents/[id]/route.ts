import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Internal team roles may delete documents. External partner/referral roles may not.
const DELETE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(DELETE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: existing } = await supabase
    .from('documents')
    .select('id,organization_id,file_name,label,deal_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 });

  // Soft delete: hide from the CRM but keep the stored file so an admin can recover it.
  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile.id })
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'document_deleted',
    resource_type: 'documents',
    resource_id: existing.id,
    old_data: { file_name: existing.file_name, label: existing.label, deal_id: existing.deal_id },
  }).then(() => null, () => null);

  return NextResponse.json({ success: true });
}
