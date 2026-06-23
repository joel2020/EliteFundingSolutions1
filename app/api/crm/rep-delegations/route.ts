import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { isInternalCrmRole } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['super_admin', 'admin', 'manager'];

export async function GET() {
  const auth = await requireCrmProfile(MANAGE_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data, error } = await supabase
    .from('rep_delegations')
    .select('id,delegate_user_profile_id,owner_user_profile_id,created_at')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data || [] });
}

const createSchema = z.object({
  delegate_user_profile_id: z.string().uuid(),
  owner_user_profile_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(MANAGE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid delegation payload.' }, { status: 400 });
  const { delegate_user_profile_id, owner_user_profile_id } = parsed.data;
  if (delegate_user_profile_id === owner_user_profile_id) {
    return NextResponse.json({ success: false, error: 'A rep cannot be delegated to themselves.' }, { status: 400 });
  }

  // Both must be active internal users in the same organization.
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id,role,organization_id,is_active,deleted_at')
    .in('id', [delegate_user_profile_id, owner_user_profile_id])
    .eq('organization_id', profile.organization_id);
  const valid = (profiles || []).filter((p: any) => p.is_active && !p.deleted_at && isInternalCrmRole(p.role));
  if (valid.length !== 2) {
    return NextResponse.json({ success: false, error: 'Both reps must be active internal team members in your organization.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('rep_delegations')
    .upsert(
      { organization_id: profile.organization_id, delegate_user_profile_id, owner_user_profile_id, created_by: profile.id },
      { onConflict: 'organization_id,delegate_user_profile_id,owner_user_profile_id' },
    );
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'rep_delegation_created',
    resource_type: 'rep_delegations',
    new_data: { delegate_user_profile_id, owner_user_profile_id },
  }).then(() => null, () => null);

  return NextResponse.json({ success: true });
}
