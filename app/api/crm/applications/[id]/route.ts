import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const APP_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

const advanceSchema = z.object({
  funder_name: z.string().trim().optional().default(''),
  current_balance: z.string().trim().optional().default(''),
  original_amount: z.string().trim().optional().default(''),
  daily_payment: z.string().trim().optional().default(''),
});

const applicationSchema = z.object({
  use_of_funds: z.string().trim().optional().nullable(),
  has_existing_advances: z.boolean().optional(),
  existing_advances: z.array(advanceSchema).optional(),
});

const toNumber = (value: string) => {
  const cleaned = String(value ?? '').replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(APP_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = applicationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid application payload.', issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const { data: application } = await supabase
    .from('applications')
    .select('id,organization_id,application_payload')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();
  if (!application) return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });

  // Normalize advances (kept as strings in the payload, as numbers in the table).
  const advances = (input.existing_advances || [])
    .map((a) => ({
      funder_name: String(a.funder_name || '').trim(),
      current_balance: String(a.current_balance || '').trim(),
      original_amount: String(a.original_amount || '').trim(),
      daily_payment: String(a.daily_payment || '').trim(),
    }))
    .filter((a) => a.funder_name || a.current_balance || a.original_amount || a.daily_payment);
  const hasAdvances = input.has_existing_advances ?? advances.length > 0;

  const payload = { ...(application.application_payload || {}) } as Record<string, any>;
  if (input.use_of_funds !== undefined) payload.use_of_funds = input.use_of_funds || '';
  if (input.existing_advances !== undefined) {
    payload.existing_advances = advances;
    payload.has_existing_advances = hasAdvances;
  }

  const update: Record<string, any> = { application_payload: payload };
  if (input.use_of_funds !== undefined) update.use_of_funds = input.use_of_funds || null;
  if (input.existing_advances !== undefined || input.has_existing_advances !== undefined) update.has_existing_advances = hasAdvances;

  const { error } = await supabase
    .from('applications')
    .update(update)
    .eq('id', application.id)
    .eq('organization_id', profile.organization_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Replace the normalized existing_advances rows when advances were supplied.
  if (input.existing_advances !== undefined) {
    await supabase.from('existing_advances').delete().eq('application_id', application.id).eq('organization_id', profile.organization_id);
    if (advances.length) {
      await supabase.from('existing_advances').insert(advances.map((a) => ({
        organization_id: profile.organization_id,
        application_id: application.id,
        funder_name: a.funder_name || null,
        original_funded_amount: toNumber(a.original_amount),
        current_balance: toNumber(a.current_balance),
        daily_payment: toNumber(a.daily_payment),
      })));
    }
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'application_updated',
    resource_type: 'applications',
    resource_id: application.id,
    new_data: { use_of_funds: input.use_of_funds !== undefined, advances: advances.length },
  }).then(() => null, () => null);

  return NextResponse.json({ success: true });
}
