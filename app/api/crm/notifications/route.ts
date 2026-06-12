import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data: notifications, error } = await supabase
    .from('crm_notifications')
    .select('id,title,body,severity,status,resource_type,resource_id,created_at,recipient_user_profile_id')
    .eq('organization_id', profile.organization_id)
    .neq('status', 'dismissed')
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // RLS already restricts visibility; dedupe broadcast + personal copies of the same event.
  const seen = new Set<string>();
  const rows = (notifications || []).filter((row) => {
    const key = `${row.title}|${row.resource_id}|${String(row.created_at).slice(0, 19)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);

  return NextResponse.json({
    success: true,
    notifications: rows,
    unreadCount: rows.filter((row) => row.status === 'unread').length,
  });
}

const patchSchema = z.object({
  notification_id: z.string().uuid().optional(),
  mark_all_read: z.boolean().optional().default(false),
});

export async function PATCH(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || (!parsed.data.notification_id && !parsed.data.mark_all_read)) {
    return NextResponse.json({ success: false, error: 'Invalid notification update.' }, { status: 400 });
  }

  let query = supabase
    .from('crm_notifications')
    .update({ status: 'read', read_at: new Date().toISOString() })
    .eq('organization_id', profile.organization_id)
    .eq('status', 'unread');
  if (parsed.data.notification_id) query = query.eq('id', parsed.data.notification_id);

  const { error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
