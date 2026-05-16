import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const TASK_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

const taskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  due_date: z.string().trim().optional().nullable(),
  priority: z.string().trim().default('medium'),
  status: z.string().trim().default('open'),
});

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(TASK_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = taskSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid task payload.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      ...parsed.data,
      organization_id: profile.organization_id,
      assigned_user_id: profile.id,
      created_by: profile.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      activity_type: 'task',
      title: 'Task created',
      body: data.title,
      direction: 'internal',
      performed_by: profile.id,
      resource_type: 'tasks',
      resource_id: data.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'task_created',
      resource_type: 'tasks',
      resource_id: data.id,
      new_data: { title: data.title },
    }),
  ]);

  return NextResponse.json({ success: true, data });
}
