import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'underwriter'];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data: offer } = await supabase
    .from('offers')
    .select('id,organization_id,deal_id,status')
    .eq('id', (await params).id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!offer) return NextResponse.json({ success: false, error: 'Offer not found.' }, { status: 404 });

  const { error } = await supabase
    .from('offers')
    .update({ status: 'presented', presented_at: new Date().toISOString() })
    .eq('id', offer.id)
    .eq('organization_id', profile.organization_id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: offer.deal_id,
      activity_type: 'offer',
      title: 'Offer presented',
      body: 'Offer marked as presented from CRM offers page.',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'offer_presented',
      resource_type: 'offers',
      resource_id: offer.id,
      old_data: { status: offer.status },
      new_data: { status: 'presented' },
    }),
  ]);

  return NextResponse.json({ success: true, dealId: offer.deal_id });
}
