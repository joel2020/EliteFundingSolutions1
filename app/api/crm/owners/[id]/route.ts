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
  // Plaintext sensitive values — only re-encrypted when a non-empty value is supplied.
  ssn: z.string().trim().optional().nullable(),
  dob: z.string().trim().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

  const { data: existing } = await supabase
    .from('owners')
    .select('id,organization_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();
  if (!existing) return NextResponse.json({ success: false, error: 'Owner not found.' }, { status: 404 });

  const first = input.first_name ?? undefined;
  const last = input.last_name ?? undefined;
  const update: Record<string, any> = { updated_by: profile.id };
  if (first !== undefined) update.first_name = first || null;
  if (last !== undefined) update.last_name = last || null;
  if (first !== undefined || last !== undefined) {
    update.full_name = [first, last].filter(Boolean).join(' ').trim() || null;
  }
  if (input.email !== undefined) update.email = input.email || null;
  if (input.phone !== undefined) update.phone = input.phone || null;
  if (input.address !== undefined) { update.address = input.address || null; update.home_address = input.address || null; }
  if (input.city !== undefined) update.city = input.city || null;
  if (input.state !== undefined) update.state = input.state || null;
  if (input.zip !== undefined) update.zip = input.zip || null;
  if (input.ownership_percentage !== undefined) update.ownership_percentage = input.ownership_percentage;
  if (input.credit_score_range !== undefined) update.credit_score_range = input.credit_score_range || null;

  const ssnDigits = digitsOnly(input.ssn);
  if (ssnDigits) {
    update.ssn_encrypted = encryptSensitiveField(ssnDigits);
    update.ssn_last4 = ssnDigits.slice(-4);
    update.ssn_last_four = ssnDigits.slice(-4);
  }
  const dob = (input.dob || '').trim();
  if (dob) update.dob_encrypted = encryptSensitiveField(dob);

  const { error } = await supabase
    .from('owners')
    .update(update)
    .eq('id', existing.id)
    .eq('organization_id', profile.organization_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Keep the business_owners link in sync for ownership % / primary flag.
  if (input.ownership_percentage !== undefined || input.is_primary !== undefined) {
    const linkUpdate: Record<string, any> = {};
    if (input.ownership_percentage !== undefined) linkUpdate.ownership_percentage = input.ownership_percentage;
    if (input.is_primary !== undefined) linkUpdate.is_primary = input.is_primary;
    await supabase
      .from('business_owners')
      .update(linkUpdate)
      .eq('owner_id', existing.id)
      .eq('organization_id', profile.organization_id);
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'owner_updated',
    resource_type: 'owners',
    resource_id: existing.id,
    new_data: { fields: Object.keys(update).filter((k) => k !== 'updated_by') },
  }).then(() => null, () => null);

  return NextResponse.json({ success: true });
}
