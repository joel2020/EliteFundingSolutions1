import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const callbackUrl = new URL('/auth/callback', request.url);
  const requestUrl = new URL(request.url);
  requestUrl.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value);
  });

  return NextResponse.redirect(callbackUrl);
}
