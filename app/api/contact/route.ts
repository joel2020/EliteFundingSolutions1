import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';

const digitsOnly = (value?: string) => (value || '').replace(/\D/g, '');
const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  phone: z.string().optional().default('').refine((value) => !value || digitsOnly(value).length >= 10, 'Phone must be valid.'),
  message: z.string().trim().min(5).max(5000),
  type: z.string().trim().max(80).optional().default('general'),
  bot_field: z.string().optional().default(''),
});

const buckets = new Map<string, { count: number; resetAt: number }>();
const getClientIp = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
function isRateLimited(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 5;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ success: false, error: 'Too many requests. Please wait and try again.' }, { status: 429 });
  }

  const parsed = contactSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Please provide a valid name, email, phone, and message.' }, { status: 400 });
  }

  const { name, email, phone, message, type, bot_field } = parsed.data;
  if (bot_field) return NextResponse.json({ success: true });

  try {
    const supabase = createServiceSupabaseClient();
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

  await sendEmail({
    to: process.env.ADMIN_EMAIL || 'admin@elitefundingsolution.com',
    subject: `Website inquiry from ${name}`,
    html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone || 'Not provided'}</p><p><strong>Type:</strong> ${type}</p><p>${message.replace(/[<>]/g, '')}</p>`,
  });

  return NextResponse.json({ success: true });
}
