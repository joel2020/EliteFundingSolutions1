import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const taskSchema = z.object({
  title: z.string().trim().min(1).max(240),
  due_date: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = taskSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid task payload.', issues: parsed.error.flatten() }, { status: 400 });

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,assigned_user_id')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const dueDate = parsed.data.due_date ? new Date(parsed.data.due_date).toISOString() : null;
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      title: parsed.data.title,
      due_date: dueDate,
      priority: parsed.data.priority,
      status: 'open',
      assigned_user_id: deal.assigned_user_id || profile.id,
      created_by: profile.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'task',
      title: `Task created: ${parsed.data.title}`,
      body: dueDate ? `Due ${dueDate.slice(0, 10)}` : null,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'deal_task_created',
      resource_type: 'tasks',
      resource_id: task.id,
      new_data: parsed.data,
    }),
  ]);

  return NextResponse.json({ success: true, taskId: task.id });
}
