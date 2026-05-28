import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const GMAIL_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

export async function GET(request: NextRequest) {
  const auth = await requireCrmProfile(GMAIL_ROLES);
  if ('response' in auth) return auth.response;

  try {
    const redirectUri = new URL('/api/gmail/callback', request.nextUrl.origin).toString();
    const authUrl = getAuthUrl({ redirectUri, userId: auth.user.id });
    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Gmail auth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
