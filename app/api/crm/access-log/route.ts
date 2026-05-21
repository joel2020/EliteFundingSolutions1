import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmAccess, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const schema = z.object({
  action: z.enum(['external_deal_viewed', 'external_document_viewed', 'external_document_downloaded']),
  resource_type: z.enum(['deals', 'documents']),
  resource_id: z.string().uuid(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmAccess();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid access log payload.' }, { status: 400 });
  }

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: parsed.data.action,
    resource_type: parsed.data.resource_type,
    resource_id: parsed.data.resource_id,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip'),
    user_agent: request.headers.get('user-agent'),
    new_data: {
      role: profile.role,
      access_entity_type: profile.access_entity_type,
      access_entity_id: profile.access_entity_id,
      ...parsed.data.metadata,
    },
  });

  return NextResponse.json({ success: true });
}
