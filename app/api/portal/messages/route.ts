import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPortalApplicationIds, requirePortalProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  application_id: z.string().uuid().optional().nullable(),
  body: z.string().trim().min(1).max(5000),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requirePortalProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = messageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Message body is required.' }, { status: 400 });
  }

  const applicationIds = await getPortalApplicationIds(supabase, user, profile.organization_id);
  const applicationId = parsed.data.application_id || applicationIds[0] || null;
  if (applicationId && !applicationIds.includes(applicationId)) {
    return NextResponse.json({ success: false, error: 'Application not found.' }, { status: 404 });
  }

  const { data: application } = applicationId
    ? await supabase.from('applications').select('id,business_id,lead_id').eq('id', applicationId).eq('organization_id', profile.organization_id).single()
    : { data: null };

  const subject = `Client portal message${user.email ? ` from ${user.email}` : ''}`;
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      organization_id: profile.organization_id,
      application_id: applicationId,
      direction: 'inbound',
      channel: 'portal',
      sender_user_id: profile.id,
      recipient_email: 'advisor',
      subject,
      body: parsed.data.body,
      delivery_status: 'logged',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      application_id: applicationId,
      business_id: application?.business_id || null,
      lead_id: application?.lead_id || null,
      activity_type: 'email',
      title: 'Client portal message',
      body: parsed.data.body,
      direction: 'inbound',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'portal_message_created',
      resource_type: 'messages',
      resource_id: message.id,
      new_data: { application_id: applicationId, subject },
    }),
  ]);

  return NextResponse.json({ success: true, messageId: message.id });
}
