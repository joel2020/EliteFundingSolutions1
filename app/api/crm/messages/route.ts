import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  recipient_email: z.string().trim().email().optional().nullable().or(z.literal('')),
  subject: z.string().trim().max(240).optional().nullable(),
  body: z.string().trim().min(1).max(10000),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = messageSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid message payload.', issues: parsed.error.flatten() }, { status: 400 });

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      organization_id: profile.organization_id,
      direction: 'outbound',
      channel: 'portal',
      sender_user_id: profile.id,
      recipient_email: parsed.data.recipient_email || null,
      subject: parsed.data.subject || null,
      body: parsed.data.body,
      delivery_status: 'queued',
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'crm_message_created',
    resource_type: 'messages',
    resource_id: message.id,
    new_data: { recipient_email: parsed.data.recipient_email || null, subject: parsed.data.subject || null },
  });

  return NextResponse.json({ success: true, messageId: message.id });
}
