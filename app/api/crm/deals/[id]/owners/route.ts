import { NextResponse } from 'next/server';
import { z } from 'zod';
import { digitsOnly, encryptSensitiveField } from '@/lib/security';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const OWNER_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];
const CREDIT_RANGES = ['', '720+', '680-719', '640-679', '600-639', '<600'] as const;

const ownerSchema = z.object({
  first_name: z.string().trim().optional().nullable(),
  last_name: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  zip: z.string().trim().optional().nullable(),
  ownership_percentage: z.coerce.number().min(0).max(100).optional().nullable(),
  credit_score_range: z.enum(CREDIT_RANGES).optional(),
  is_primary: z.boolean().optional(),
  ssn: z.string().trim().optional().nullable(),
  dob: z.string().trim().optional().nullable(),
});

// Create a new owner + business_owner link for a deal's business (used when a deal has no
// owner records yet, e.g. a manually created deal).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(OWNER_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = ownerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid owner payload.', issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  if (!input.first_name && !input.last_name) {
    return NextResponse.json({ success: false, error: 'Owner name is required.' }, { status: 400 });
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();
  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });
  if (!deal.business_id) return NextResponse.json({ success: false, error: 'Deal has no business to attach an owner to.' }, { status: 400 });

  const ownerRecord: Record<string, any> = {
    organization_id: profile.organization_id,
    first_name: input.first_name || null,
    last_name: input.last_name || null,
    full_name: [input.first_name, input.last_name].filter(Boolean).join(' ').trim() || null,
    email: input.email || null,
    phone: input.phone || null,
    address: input.address || null,
    home_address: input.address || null,
    city: input.city || null,
    state: input.state || null,
    zip: input.zip || null,
    ownership_percentage: input.ownership_percentage ?? null,
    credit_score_range: input.credit_score_range || null,
    created_by: profile.id,
    updated_by: profile.id,
  };
  const ssnDigits = digitsOnly(input.ssn);
  if (ssnDigits) {
    ownerRecord.ssn_encrypted = encryptSensitiveField(ssnDigits);
    ownerRecord.ssn_last4 = ssnDigits.slice(-4);
    ownerRecord.ssn_last_four = ssnDigits.slice(-4);
  }
  const dob = (input.dob || '').trim();
  if (dob) ownerRecord.dob_encrypted = encryptSensitiveField(dob);

  const { data: createdOwner, error: ownerError } = await supabase
    .from('owners')
    .insert(ownerRecord)
    .select('id')
    .single();
  if (ownerError || !createdOwner) {
    return NextResponse.json({ success: false, error: ownerError?.message || 'Could not create owner.' }, { status: 500 });
  }

  const { count } = await supabase
    .from('business_owners')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .eq('business_id', deal.business_id);

  const { error: linkError } = await supabase.from('business_owners').insert({
    organization_id: profile.organization_id,
    business_id: deal.business_id,
    owner_id: createdOwner.id,
    ownership_percentage: input.ownership_percentage ?? null,
    is_primary: input.is_primary ?? Number(count || 0) === 0,
  });
  if (linkError) {
    await supabase.from('owners').delete().eq('id', createdOwner.id).eq('organization_id', profile.organization_id);
    return NextResponse.json({ success: false, error: linkError.message }, { status: 500 });
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'owner_created',
    resource_type: 'owners',
    resource_id: createdOwner.id,
    new_data: { business_id: deal.business_id },
  }).then(() => null, () => null);

  return NextResponse.json({ success: true, id: createdOwner.id });
}
