import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const TASK_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

const taskSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().nullable(),
  due_date: z.string().trim().optional().nullable(),
  priority: z.string().trim().optional(),
  status: z.string().trim().optional(),
  completed_at: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .update(parsed.data)
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'task_updated',
    resource_type: 'tasks',
    resource_id: (await params).id,
    new_data: { status: data.status, title: data.title },
  });

  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(TASK_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await supabase.from('audit_logs').insert({
    organization_id: profile.organization_id,
    user_id: user.id,
    action: 'task_deleted',
    resource_type: 'tasks',
    resource_id: (await params).id,
  });

  return NextResponse.json({ success: true });
}
