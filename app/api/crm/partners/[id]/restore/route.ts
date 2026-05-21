import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: existing } = await supabase
    .from('funding_partners')
    .select('id,organization_id,name,is_active,deleted_at,deleted_by')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .not('deleted_at', 'is', null)
    .single();

  if (!existing) {
    return NextResponse.json({ success: false, error: 'Archived lender not found.' }, { status: 404 });
  }

  const { data: restored, error } = await supabase
    .from('funding_partners')
    .update({ is_active: true, deleted_at: null, deleted_by: null })
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'funding_partner_restored',
    resource_type: 'funding_partners',
    resource_id: existing.id,
    old_data: existing,
    new_data: { is_active: true, deleted_at: null },
  });

  return NextResponse.json({ success: true, partner: restored });
}
