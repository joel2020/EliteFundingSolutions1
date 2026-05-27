import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: task } = await supabase
    .from('tasks')
    .select('id,organization_id,deal_id,application_id,business_id,title,status')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!task) return NextResponse.json({ success: false, error: 'Task not found.' }, { status: 404 });

  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from('tasks')
    .update({ status: 'completed', completed_at: completedAt, updated_by: profile.id })
    .eq('id', task.id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: task.deal_id,
      application_id: task.application_id,
      business_id: task.business_id,
      activity_type: 'task',
      title: `Task completed: ${task.title}`,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'task_completed',
      resource_type: 'tasks',
      resource_id: task.id,
      old_data: { status: task.status },
      new_data: { status: 'completed', completed_at: completedAt },
    }),
  ]);

  return NextResponse.json({ success: true });
}
