import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const SIGNATURE_ROLES = ['super_admin', 'admin', 'manager', 'processor', 'underwriter'];

const signatureSchema = z.object({
  signature_status: z.literal('requires_resign'),
  reason: z.string().trim().min(3).max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(SIGNATURE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = signatureSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid signature request payload.' }, { status: 400 });
  }

  const { id } = await params;
  const { data: application } = await supabase
    .from('applications')
    .select('id,organization_id,business_id,lead_id,status,signature_status,signed_name,signed_at')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!application) {
    return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('id')
    .eq('application_id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  const { data: updated, error } = await supabase
    .from('applications')
    .update({
      signature_status: 'requires_resign',
      updated_by: profile.id,
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('id,signature_status')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal?.id || null,
      application_id: application.id,
      business_id: application.business_id,
      lead_id: application.lead_id,
      activity_type: 'signature',
      title: 'Updated application signature requested',
      body: parsed.data.reason || 'Application was marked as requiring a new signature.',
      direction: 'internal',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'application_signature_update_requested',
      resource_type: 'applications',
      resource_id: application.id,
      old_data: {
        signature_status: application.signature_status,
        signed_name: application.signed_name,
        signed_at: application.signed_at,
      },
      new_data: {
        signature_status: 'requires_resign',
        reason: parsed.data.reason || null,
      },
    }),
  ]);

  return NextResponse.json({ success: true, application: updated });
}
