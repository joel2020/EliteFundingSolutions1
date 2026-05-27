import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];
const READ_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter', 'funder', 'iso', 'broker'];

const articleSchema = z.object({
  category: z.string().trim().min(1),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  image_urls: z.array(z.string().url()).optional().default([]),
  status: z.enum(['draft', 'published', 'archived']).optional().default('published'),
});

export async function GET() {
  const auth = await requireCrmProfile(READ_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data, error } = await supabase
    .from('knowledge_base_articles')
    .select('id,category,title,body,image_urls,status,created_at,updated_at,created_by,updated_by')
    .eq('organization_id', profile.organization_id)
    .neq('status', 'archived')
    .order('category')
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, articles: data || [] });
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const parsed = articleSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid article payload.', issues: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase
    .from('knowledge_base_articles')
    .insert({
      organization_id: profile.organization_id,
      ...parsed.data,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, articleId: data.id });
}
