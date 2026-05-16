import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const noteSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  is_internal: z.boolean().default(true),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = noteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Note body is required.' }, { status: 400 });

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const { data: note, error } = await supabase
    .from('notes')
    .insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      body: parsed.data.body,
      is_internal: parsed.data.is_internal,
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
      activity_type: 'note',
      title: parsed.data.is_internal ? 'Internal note added' : 'Shared note added',
      body: parsed.data.body,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'deal_note_created',
      resource_type: 'notes',
      resource_id: note.id,
      new_data: { deal_id: deal.id, is_internal: parsed.data.is_internal },
    }),
  ]);

  return NextResponse.json({ success: true, noteId: note.id });
}
