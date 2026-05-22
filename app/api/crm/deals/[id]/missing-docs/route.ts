import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { COMPANY } from '@/lib/company';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

function createDealToken() {
  return `deal_${randomBytes(18).toString('base64url')}`;
}

function originFromRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const host = request.headers.get('host');
  return host ? `https://${host}` : COMPANY.domain;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const body = await request.json().catch(() => ({}));
  const requestedItems = Array.isArray(body.items) ? body.items.map((item: any) => ({
    document_type: String(item.document_type || item.key || '').trim(),
    label: String(item.label || item.name || '').trim(),
    category: String(item.category || 'submission').trim(),
    notes: String(item.notes || '').trim(),
  })).filter((item: any) => item.document_type && item.label) : [];
  const recipientEmail = String(body.email || '').trim().toLowerCase();
  const customMessage = String(body.message || '').trim();

  if (!requestedItems.length) {
    return NextResponse.json({ success: false, error: 'Select at least one missing item to request.' }, { status: 400 });
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,title,assigned_user_id,businesses(legal_name,email)')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const token = createDealToken();
  const applicationUrl = `${originFromRequest(request)}/apply?deal=${encodeURIComponent(token)}`;
  const emailTo = recipientEmail || (deal as any).businesses?.email || '';

  const upserts = await Promise.allSettled(requestedItems.map(async (item: any) => {
    const { data: existing } = await supabase
      .from('document_requests')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('deal_id', deal.id)
      .eq('document_type', item.document_type)
      .maybeSingle();
    const payload = {
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      document_type: item.document_type,
      label: item.label,
      required: true,
      status: 'requested',
      category: ['submission', 'funding', 'stipulation', 'compliance'].includes(item.category) ? item.category : 'submission',
      notes: item.notes || customMessage || 'Requested from missing-items workflow.',
      assigned_user_id: deal.assigned_user_id || null,
      created_by: profile.id,
      updated_by: profile.id,
    };
    return existing?.id
      ? supabase.from('document_requests').update(payload).eq('id', existing.id).eq('organization_id', profile.organization_id).select('id').single()
      : supabase.from('document_requests').insert(payload).select('id').single();
  }));

  const failed = upserts.find((result) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error));
  if (failed?.status === 'rejected') {
    return NextResponse.json({ success: false, error: failed.reason?.message || 'Unable to create missing-items request.' }, { status: 500 });
  }
  if (failed?.status === 'fulfilled') {
    return NextResponse.json({ success: false, error: failed.value.error.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('deals')
    .update({ application_link_token: token, application_link_sent_at: new Date().toISOString() })
    .eq('id', deal.id)
    .eq('organization_id', profile.organization_id);

  if (updateError) return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });

  let emailStatus: 'not_sent' | 'sent' | 'failed' = 'not_sent';
  let emailError: string | null = null;
  if (emailTo) {
    const itemList = requestedItems.map((item: any) => `<li>${item.label}</li>`).join('');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #111827;">
        <h2 style="color:#0F2B5B;">Additional items needed</h2>
        <p>${customMessage || 'Please complete the secure application link and upload or provide the missing items listed below.'}</p>
        <ul>${itemList}</ul>
        <p><a href="${applicationUrl}" style="display:inline-block;background:#0F2B5B;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Open Secure Request</a></p>
        <p style="font-size:12px;color:#64748B;">This request is attached directly to your Elite Funding Solutions deal record.</p>
      </div>
    `;
    const result = await sendEmail({
      to: emailTo,
      subject: 'Additional items needed for your funding review',
      html,
      text: `${customMessage || 'Additional items are needed for your funding review.'}\n\n${requestedItems.map((item: any) => `- ${item.label}`).join('\n')}\n\n${applicationUrl}`,
    });
    emailStatus = result.success ? 'sent' : 'failed';
    emailError = result.success ? null : result.error || 'Email send failed.';
  }

  await Promise.allSettled([
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      deal_id: deal.id,
      application_id: deal.application_id,
      business_id: deal.business_id,
      lead_id: deal.lead_id,
      activity_type: 'document_event',
      title: 'Missing items requested',
      body: requestedItems.map((item: any) => item.label).join(', '),
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'missing_items_requested',
      resource_type: 'deals',
      resource_id: deal.id,
      new_data: { email_sent: emailStatus, recipient_email: emailTo || null, requested_items: requestedItems.map((item: any) => item.document_type) },
    }),
  ]);

  return NextResponse.json({ success: true, applicationUrl, emailStatus, emailError, requestedItems });
}
