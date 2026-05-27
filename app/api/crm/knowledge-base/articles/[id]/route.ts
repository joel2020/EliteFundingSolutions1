import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];

const articleSchema = z.object({
  category: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1).optional(),
  image_urls: z.array(z.string().url()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const parsed = articleSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid article payload.', issues: parsed.error.flatten() }, { status: 400 });

  const { error } = await supabase
    .from('knowledge_base_articles')
    .update({ ...parsed.data, updated_by: profile.id })
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { error } = await supabase
    .from('knowledge_base_articles')
    .update({ status: 'archived', updated_by: profile.id })
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
