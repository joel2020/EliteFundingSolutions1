import { NextResponse } from 'next/server';
import { z } from 'zod';
import { digitsOnly, encryptSensitiveField, hashSensitiveLookup } from '@/lib/security';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const BUSINESS_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

const businessSchema = z.object({
  legal_name: z.string().trim().min(1),
  dba: z.string().trim().optional().nullable(),
  entity_type: z.string().trim().optional().nullable(),
  industry: z.string().trim().optional().nullable(),
  start_date: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  website: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().nullable(),
  zip: z.string().trim().optional().nullable(),
  monthly_gross_revenue: z.coerce.number().nullable().optional(),
  average_daily_balance: z.coerce.number().nullable().optional(),
  deposit_count_monthly: z.coerce.number().int().nullable().optional(),
  notes: z.string().trim().optional().nullable(),
  // Plaintext EIN — re-encrypted only when a non-empty value is supplied.
  ein: z.string().trim().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(BUSINESS_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = businessSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid business payload.' }, { status: 400 });
  }

  const { ein, ...businessFields } = parsed.data;
  const update: Record<string, any> = { ...businessFields, email: parsed.data.email || null, updated_by: profile.id };
  const einDigits = digitsOnly(ein);
  if (einDigits) {
    update.ein_encrypted = encryptSensitiveField(einDigits);
    update.ein_hash = hashSensitiveLookup(einDigits);
    update.ein_last4 = einDigits.slice(-4);
  }

  const { data, error } = await supabase
    .from('businesses')
    .update(update)
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'business_updated',
    resource_type: 'businesses',
    resource_id: params.id,
    new_data: { legal_name: data.legal_name },
  });

  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(BUSINESS_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { error } = await supabase
    .from('businesses')
    .update({ deleted_at: new Date().toISOString(), updated_by: profile.id })
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'business_deleted',
    resource_type: 'businesses',
    resource_id: params.id,
  });

  return NextResponse.json({ success: true });
}
