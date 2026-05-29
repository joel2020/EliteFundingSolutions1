import { NextResponse } from 'next/server';
import { decryptSensitiveField } from '@/lib/security';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const REVEAL_ROLES = ['super_admin', 'admin'];

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(REVEAL_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: application } = await supabase
    .from('applications')
    .select('id,organization_id,business_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!application) return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });

  const [{ data: business }, { data: ownerLinks }] = await Promise.all([
    application.business_id
      ? supabase
        .from('businesses')
        .select('id,ein_encrypted,ein_last4')
        .eq('id', application.business_id)
        .eq('organization_id', profile.organization_id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    application.business_id
      ? supabase
        .from('business_owners')
        .select('is_primary,owners(id,first_name,last_name,dob_encrypted,ssn_encrypted,ssn_last4)')
        .eq('organization_id', profile.organization_id)
        .eq('business_id', application.business_id)
        .order('is_primary', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const primaryOwner = (ownerLinks || [])[0]?.owners as any;
  const sensitive = {
    business: {
      ein: decryptSensitiveField((business as any)?.ein_encrypted) || null,
      ein_last4: (business as any)?.ein_last4 || null,
    },
    owners: primaryOwner ? [{
      id: primaryOwner.id,
      name: [primaryOwner.first_name, primaryOwner.last_name].filter(Boolean).join(' '),
      ssn: decryptSensitiveField(primaryOwner.ssn_encrypted) || null,
      ssn_last4: primaryOwner.ssn_last4 || null,
      dob: decryptSensitiveField(primaryOwner.dob_encrypted) || null,
    }] : [],
  };

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'application_sensitive_fields_revealed',
    resource_type: 'applications',
    resource_id: application.id,
    new_data: {
      fields: ['ein', 'owner_ssn', 'owner_dob'],
      business_id: application.business_id,
      owner_id: primaryOwner?.id || null,
    },
  });

  return NextResponse.json({ success: true, data: sensitive, sensitive });
}
