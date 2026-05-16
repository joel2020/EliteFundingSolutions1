import { NextResponse } from 'next/server';
import { requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  return NextResponse.json({
    success: false,
    error: 'Global document uploads are disabled. Upload documents from the individual deal page.',
  }, { status: 410 });
}
