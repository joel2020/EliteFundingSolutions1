import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  custom_message: z.string().optional().nullable(),
  decline_reason: z.string().optional().nullable(),
  conditions: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid lender submission update.' }, { status: 400 });

  const { data: submission } = await supabase
    .from('partner_submissions')
    .select('id,organization_id,deal_id,application_id,status,notes,custom_message,decline_reason,funding_partners(name)')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!submission) return NextResponse.json({ success: false, error: 'Lender submission not found.' }, { status: 404 });

  const patch = {
    ...parsed.data,
    response_date: parsed.data.status && parsed.data.status !== submission.status ? new Date().toISOString() : undefined,
    updated_by: profile.id,
  };

  const { error } = await supabase
    .from('partner_submissions')
    .update(patch)
    .eq('id', submission.id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: submission.deal_id,
      application_id: submission.application_id,
      activity_type: 'partner_submission',
      title: 'Lender submission updated',
      body: parsed.data.status ? `${submission.status} -> ${parsed.data.status}` : parsed.data.notes || parsed.data.custom_message || parsed.data.decline_reason || 'Submission updated',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'partner_submission_updated',
      resource_type: 'partner_submissions',
      resource_id: submission.id,
      old_data: { status: submission.status, notes: submission.notes, custom_message: submission.custom_message, decline_reason: submission.decline_reason },
      new_data: parsed.data,
    }),
  ]);

  return NextResponse.json({ success: true });
}
