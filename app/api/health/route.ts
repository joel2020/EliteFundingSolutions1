import { NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/server-supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceSupabaseClient();
    const { error } = await supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      return NextResponse.json({ status: 'degraded' }, { status: 503 });
    }

    return NextResponse.json({
      status: 'ok',
      service: 'elite-funding-crm',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: 'degraded' }, { status: 503 });
  }
}
