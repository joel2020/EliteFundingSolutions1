import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireCrmProfile(['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter']);
  if ('response' in auth) return auth.response;

  try {
    const authUrl = getAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Gmail auth error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
