import { NextResponse } from 'next/server';
import { decryptSensitiveField } from '@/lib/security';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Any internal CRM team member can see full fields on the deal workspace (no masking).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const [{ data: business }, { data: ownerLinks }] = await Promise.all([
    deal.business_id
      ? supabase
        .from('businesses')
        .select('id,ein_encrypted,ein_last4')
        .eq('id', deal.business_id)
        .eq('organization_id', profile.organization_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    deal.business_id
      ? supabase
        .from('business_owners')
        .select('is_primary,owners(id,first_name,last_name,full_name,ssn_encrypted,ssn_last4,dob_encrypted)')
        .eq('organization_id', profile.organization_id)
        .eq('business_id', deal.business_id)
        .order('is_primary', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const owners = (ownerLinks || [])
    .map((link: any) => link.owners)
    .filter(Boolean)
    .map((owner: any) => ({
      id: owner.id,
      name: [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.full_name || null,
      ssn: decryptSensitiveField(owner.ssn_encrypted) || null,
      ssn_last4: owner.ssn_last4 || null,
      dob: decryptSensitiveField(owner.dob_encrypted) || null,
    }));

  const data = {
    business: {
      ein: decryptSensitiveField((business as any)?.ein_encrypted) || null,
      ein_last4: (business as any)?.ein_last4 || null,
    },
    owners,
  };

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'deal_sensitive_fields_viewed',
    resource_type: 'deals',
    resource_id: deal.id,
    new_data: { business_id: deal.business_id, owner_count: owners.length },
  }).then(() => null, () => null);

  return NextResponse.json({ success: true, data });
}
