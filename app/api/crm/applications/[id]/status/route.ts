import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];
const statusSchema = z.object({
  status: z.string().min(1),
  notes: z.string().optional().default('CRM application status update.'),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = statusSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid status payload.' }, { status: 400 });
  }

  const { data: application, error: loadError } = await supabase
    .from('applications')
    .select('id,organization_id,business_id,lead_id,status')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (loadError || !application) {
    return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
  }

  const previousStatus = application.status || null;
  const nextStatus = parsed.data.status;
  const { error: updateError } = await supabase
    .from('applications')
    .update({ status: nextStatus, updated_by: profile.id })
    .eq('id', application.id)
    .eq('organization_id', profile.organization_id);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  await Promise.allSettled([
    supabase.from('status_history').insert({
      organization_id: profile.organization_id,
      application_id: application.id,
      previous_status: previousStatus,
      new_status: nextStatus,
      changed_by: profile.id,
      notes: parsed.data.notes,
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      application_id: application.id,
      business_id: application.business_id,
      lead_id: application.lead_id,
      activity_type: 'status_change',
      title: 'Application status updated',
      body: `${previousStatus || 'none'} -> ${nextStatus}`,
      direction: 'internal',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'application_status_updated',
      resource_type: 'applications',
      resource_id: application.id,
      old_data: { status: previousStatus },
      new_data: { status: nextStatus },
    }),
  ]);

  return NextResponse.json({ success: true });
}
