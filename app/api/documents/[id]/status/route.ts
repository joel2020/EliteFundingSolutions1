import { NextResponse } from 'next/server';
import { z } from 'zod';
import { INTERNAL_CRM_ROLES, requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const statusSchema = z.object({
  status: z.string().trim().min(1),
  review_notes: z.string().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(INTERNAL_CRM_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = statusSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid document status payload.' }, { status: 400 });

  const { data: doc } = await supabase
    .from('documents')
    .select('id,organization_id,deal_id,application_id,file_name,label,status,review_notes')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!doc) return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 });

  const reviewedAt = new Date().toISOString();
  const { error } = await supabase
    .from('documents')
    .update({
      status: parsed.data.status,
      reviewed_by: profile.id,
      reviewed_at: reviewedAt,
      review_notes: parsed.data.review_notes || doc.review_notes || null,
    })
    .eq('id', doc.id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: doc.deal_id,
      application_id: doc.application_id,
      activity_type: 'document_event',
      title: `Document status changed: ${doc.label || doc.file_name}`,
      body: `${doc.status || 'uploaded'} -> ${parsed.data.status}${parsed.data.review_notes ? ` - ${parsed.data.review_notes}` : ''}`,
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'document_status_updated',
      resource_type: 'documents',
      resource_id: doc.id,
      old_data: { status: doc.status },
      new_data: { status: parsed.data.status, review_notes: parsed.data.review_notes || null },
    }),
  ]);

  return NextResponse.json({ success: true });
}
