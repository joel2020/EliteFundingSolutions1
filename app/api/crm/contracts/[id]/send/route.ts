import { NextResponse } from 'next/server';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const CONTRACT_ROLES = ['super_admin', 'admin', 'manager', 'processor'];

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(CONTRACT_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const { data, error } = await supabase
    .from('contracts')
    .update({ status: 'sent', sent_date: new Date().toISOString() })
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .select('id,deal_id,status')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: data.deal_id,
      activity_type: 'contract',
      title: 'Contract sent',
      body: 'Contract moved to sent status.',
      direction: 'outbound',
      performed_by: profile.id,
      resource_type: 'contracts',
      resource_id: data.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'contract_sent',
      resource_type: 'contracts',
      resource_id: data.id,
      new_data: { status: data.status },
    }),
  ]);

  return NextResponse.json({ success: true, data });
}
