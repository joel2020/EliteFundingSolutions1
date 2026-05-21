import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { COMPANY } from '@/lib/company';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor'];

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
  const recipientEmail = String(body.email || '').trim().toLowerCase();
  const customMessage = String(body.message || '').trim();

  const { data: deal } = await supabase
    .from('deals')
    .select('id,organization_id,business_id,application_id,lead_id,title,businesses(legal_name,email)')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .single();

  if (!deal) return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });

  const token = createDealToken();
  const applicationUrl = `${originFromRequest(request)}/apply?deal=${encodeURIComponent(token)}`;
  const emailTo = recipientEmail || (deal as any).businesses?.email || '';

  const { error: updateError } = await supabase
    .from('deals')
    .update({ application_link_token: token, application_link_sent_at: new Date().toISOString() })
    .eq('id', deal.id)
    .eq('organization_id', profile.organization_id);

  if (updateError) return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });

  let emailStatus: 'not_sent' | 'sent' | 'failed' = 'not_sent';
  let emailError: string | null = null;
  if (emailTo) {
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="color:#0F2B5B;">Complete your Elite Funding Solutions application</h2>
        <p>${customMessage || 'Please complete the secure application so our funding team can finish reviewing your file.'}</p>
        <p><a href="${applicationUrl}" style="display:inline-block;background:#0F2B5B;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700;">Complete Application</a></p>
        <p style="font-size:12px;color:#64748B;">This link attaches your application directly to your existing deal record.</p>
      </div>
    `;
    const result = await sendEmail({
      to: emailTo,
      subject: 'Complete your Elite Funding Solutions application',
      html,
      text: `${customMessage || 'Please complete the secure application.'}\n\n${applicationUrl}`,
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
      activity_type: 'system',
      title: 'Customer application link created',
      body: emailTo ? `Sent to ${emailTo}` : 'Link generated without email recipient.',
      performed_by: profile.id,
    }),
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'customer_application_link_created',
      resource_type: 'deals',
      resource_id: deal.id,
      new_data: { email_sent: emailStatus, recipient_email: emailTo || null },
    }),
  ]);

  return NextResponse.json({ success: true, applicationUrl, emailStatus, emailError });
}
