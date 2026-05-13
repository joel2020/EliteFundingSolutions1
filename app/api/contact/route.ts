import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().default(''),
  message: z.string().min(5),
  type: z.string().optional().default('general'),
});

export async function POST(request: Request) {
  const parsed = contactSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Please provide your name, email, and message.' }, { status: 400 });
  }

  const { name, email, phone, message, type } = parsed.data;
  const result = await sendEmail({
    to: process.env.ADMIN_EMAIL || 'admin@elitefundingsolution.com',
    subject: `Website inquiry from ${name}`,
    html: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone || 'Not provided'}</p><p><strong>Type:</strong> ${type}</p><p>${message}</p>`,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
