import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'Lender ID required' }, { status: 400 });

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  // Verify partner/lender belongs to this organization
  const { data: existing } = await supabase
    .from('funding_partners')
    .select('id, organization_id, name')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Lender not found' }, { status: 404 });

  // Delete the partner/lender record
  const { error } = await supabase
    .from('funding_partners')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'funding_partner_deleted',
    resource_type: 'funding_partners',
    resource_id: id,
    old_data: { name: existing.name },
    new_data: null,
  });

  return NextResponse.json({ success: true, message: 'Lender deleted successfully' });
}
