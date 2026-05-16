import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const SEND_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep'];

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(SEND_ROLES);
  if ('response' in auth) return auth.response;

  try {
    const { to, subject, html } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, html' },
        { status: 400 }
      );
    }

    const result = await sendEmail({ to, subject, html });

    if (result.success) {
      return NextResponse.json({ success: true, data: result.data });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Email request failed.' },
      { status: 500 }
    );
  }
}
