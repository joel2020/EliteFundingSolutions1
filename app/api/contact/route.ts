import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';
import { checkPersistentRateLimit, digitsOnly, escapeHtml } from '@/lib/security';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_MAX = 5;

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().optional().default('').refine((value) => !value || digitsOnly(value).length >= 10, 'Phone must be valid.'),
  message: z.string().trim().min(5).max(5000),
  type: z.string().trim().max(80).optional().default('general'),
  bot_field: z.string().optional().default(''),
});

const getClientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const supabase = createServiceSupabaseClient();

  try {
    if (await checkPersistentRateLimit(supabase, `contact:${ip}`, RATE_LIMIT_MAX)) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please wait and try again.' }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to validate message rate. Please try again shortly.' }, { status: 503 });
  }

  const parsed = contactSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Please provide a valid name, email, phone, and message.' }, { status: 400 });
  }

  const { name, email, phone, message, type, bot_field } = parsed.data;
  if (bot_field) return NextResponse.json({ success: true });

  try {
    await supabase.from('contact_submissions').insert({
      organization_id: DEFAULT_ORG_ID,
      name,
      email,
      phone: phone || null,
      inquiry_type: type,
      message,
      ip_address: ip,
      user_agent: request.headers.get('user-agent') || 'unknown',
    });
  } catch (error) {
    console.error('Contact submission storage failed.');
    return NextResponse.json({ success: false, error: 'We could not save your message. Please call us directly.' }, { status: 500 });
  }

  const emailResult = await sendEmail({
    to: process.env.ADMIN_EMAIL || 'admin@elitefundingsolution.com',
    subject: `Website inquiry from ${escapeHtml(name)}`,
    html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p><p><strong>Type:</strong> ${escapeHtml(type)}</p><p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>`,
  });

  if (!emailResult.success) {
    console.error('Contact notification email failed.');
  }

  return NextResponse.json({ success: true });
}
