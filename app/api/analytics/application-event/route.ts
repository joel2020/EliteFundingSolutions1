import { NextResponse } from 'next/server';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';

const allowedEvents = new Set([
  'application_step_started',
  'application_step_completed',
  'application_validation_error',
  'application_submit_started',
  'application_submit_success',
  'application_submit_failed',
]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const event = String(body.event || '').trim();
  if (!allowedEvents.has(event)) {
    return NextResponse.json({ success: false, error: 'Invalid event.' }, { status: 400 });
  }

  const metadata = {
    step: body.step || null,
    field: body.field || null,
    referral_path: body.referral_path || null,
    referral_code_present: Boolean(body.referral_code),
  };

  try {
    const supabase = createServiceSupabaseClient();
    await supabase.from('audit_logs').insert({
      organization_id: DEFAULT_ORG_ID,
      action: event,
      resource_type: 'public_application',
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null,
      user_agent: request.headers.get('user-agent') || null,
      new_data: metadata,
    });
  } catch {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
