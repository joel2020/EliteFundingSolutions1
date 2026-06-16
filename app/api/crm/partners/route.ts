import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { sendEmail, emailTemplates } from '@/lib/email';
import { isBlockedProductionEmail } from '@/lib/referral-tokens';

export const dynamic = 'force-dynamic';

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];

const csv = (value?: string) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);

const partnerSchema = z.object({
  name: z.string().trim().optional().default(''),
  company_name: z.string().trim().optional().default(''),
  contact_name: z.string().trim().optional().default(''),
  email: z.string().trim().email('Enter a valid contact email.').optional().or(z.literal('')).default(''),
  phone: z.string().trim().optional().default(''),
  submission_email: z.string().trim().email('Enter a valid submission email.').optional().or(z.literal('')).default(''),
  portal_url: z.string().trim().url('Enter a valid portal URL.').optional().or(z.literal('')).default(''),
  preferred_submission_method: z.enum(['email', 'portal', 'api', 'manual']).optional().nullable(),
  product_types: z.string().trim().optional().default(''),
  preferred_industries: z.string().trim().optional().default(''),
  required_documents: z.string().trim().optional().default(''),
  min_funding_amount: z.coerce.number().nonnegative().optional().nullable(),
  max_funding_amount: z.coerce.number().nonnegative().optional().nullable(),
  min_monthly_revenue: z.coerce.number().nonnegative().optional().nullable(),
  min_time_in_business_months: z.coerce.number().int().nonnegative().optional().nullable(),
  min_credit_score: z.coerce.number().int().min(300).max(850).optional().nullable(),
  max_existing_positions: z.coerce.number().int().nonnegative().optional().nullable(),
  max_negative_days: z.coerce.number().int().nonnegative().optional().nullable(),
  max_nsf_count: z.coerce.number().int().nonnegative().optional().nullable(),
  states_served: z.string().trim().optional().default(''),
  restricted_states: z.string().trim().optional().default(''),
  restricted_industries: z.string().trim().optional().default(''),
  avg_approval_days: z.coerce.number().int().nonnegative().optional().nullable(),
  criteria_notes: z.string().trim().optional().default(''),
  notes: z.string().trim().optional().default(''),
  bonus_notes: z.string().trim().optional().default(''),
}).transform((value) => ({ ...value, name: value.name || value.company_name }));

function isProductionRuntime() {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = partnerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid funding partner payload.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const form = parsed.data;
  if (!form.name) {
    return NextResponse.json({ success: false, error: 'Company name is required.' }, { status: 400 });
  }

  if (form.max_funding_amount != null && form.min_funding_amount != null && form.max_funding_amount < form.min_funding_amount) {
    return NextResponse.json({ success: false, error: 'Max funding must be greater than min funding.' }, { status: 400 });
  }
  const inviteEmail = form.submission_email || form.email;
  if (isProductionRuntime() && inviteEmail && isBlockedProductionEmail(inviteEmail)) {
    return NextResponse.json({ success: false, error: 'Test/demo email domains are blocked in production funder invites.' }, { status: 400 });
  }

  const { data: partner, error } = await supabase
    .from('funding_partners')
    .insert({
      organization_id: profile.organization_id,
      name: form.name,
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      submission_email: form.submission_email || null,
      portal_url: form.portal_url || null,
      preferred_submission_method: form.preferred_submission_method || null,
      product_types: csv(form.product_types),
      preferred_industries: csv(form.preferred_industries),
      required_documents: csv(form.required_documents),
      min_funding_amount: form.min_funding_amount ?? null,
      max_funding_amount: form.max_funding_amount ?? null,
      min_monthly_revenue: form.min_monthly_revenue ?? null,
      min_time_in_business_months: form.min_time_in_business_months ?? null,
      min_credit_score: form.min_credit_score ?? null,
      max_existing_positions: form.max_existing_positions ?? null,
      max_negative_days: form.max_negative_days ?? null,
      max_nsf_count: form.max_nsf_count ?? null,
      states_served: csv(form.states_served.toUpperCase()),
      restricted_states: csv(form.restricted_states.toUpperCase()),
      restricted_industries: csv(form.restricted_industries),
      avg_approval_days: form.avg_approval_days ?? null,
      criteria_notes: form.criteria_notes || null,
      notes: form.notes || null,
      bonus_notes: form.bonus_notes || null,
      is_active: true,
      created_by: profile.id,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let inviteWarning: string | undefined;
  let emailSent = false;
  if (inviteEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const contact = splitName(form.contact_name || form.name);
    const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const invited = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: inviteEmail,
      options: {
        redirectTo: `${appUrl}/set-password`,
        data: {
          first_name: contact.firstName,
          last_name: contact.lastName,
          role: 'funder',
          access_entity_type: 'funding_partner',
          access_entity_id: partner.id,
        },
      },
    });
    const invitedUser = invited.data?.user;
    const inviteUrl = (invited.data as any)?.properties?.action_link;
    if (invited.error || !invitedUser || !inviteUrl) {
      inviteWarning = invited.error?.message || 'Unable to generate funder invite link.';
    } else {
      const { data: funderProfile, error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: invitedUser.id,
          organization_id: profile.organization_id,
          email: inviteEmail,
          first_name: contact.firstName,
          last_name: contact.lastName,
          role: 'funder',
          company_name: form.name,
          access_entity_type: 'funding_partner',
          access_entity_id: partner.id,
          permissions: ['view_shared_deals'],
          is_active: true,
          invite_status: 'sent',
          invited_at: new Date().toISOString(),
          invite_expires_at: inviteExpiresAt,
          created_by: profile.id,
          updated_by: profile.id,
        }, { onConflict: 'user_id,organization_id' })
        .select('id')
        .single();

      if (profileError) {
        inviteWarning = profileError.message;
      } else {
        const emailResult = await sendEmail({
          to: inviteEmail,
          subject: `You've been invited to Elite Funding Solutions`,
          html: emailTemplates.userInvite(contact.firstName, inviteUrl, 'funder', form.name),
        });
        emailSent = emailResult.success;
        await supabase.from('crm_access_invites').insert({
          organization_id: profile.organization_id,
          email: inviteEmail,
          first_name: contact.firstName,
          last_name: contact.lastName,
          company_name: form.name,
          role: 'funder',
          permissions: ['view_shared_deals'],
          access_entity_type: 'funding_partner',
          access_entity_id: partner.id,
          status: emailResult.success ? 'sent' : 'failed',
          auth_user_id: invitedUser.id,
          user_profile_id: funderProfile.id,
          invited_by: profile.id,
          invite_expires_at: inviteExpiresAt,
          last_error: emailResult.success ? null : String(emailResult.error || 'Email delivery failed.'),
          metadata: { source: 'funding_partner_create' },
        });
      }
    }
  }

  await Promise.allSettled([
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: inviteEmail ? 'funder_invited' : 'funding_partner_created',
      resource_type: 'funding_partners',
      resource_id: partner.id,
      new_data: { name: form.name, submission_email: form.submission_email || null, product_types: csv(form.product_types), preferred_industries: csv(form.preferred_industries), required_documents: csv(form.required_documents), invite_email: inviteEmail || null, email_sent: emailSent },
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      activity_type: 'system',
      title: 'Funding partner created',
      body: `${form.name} was added to the lender network.`,
      direction: 'internal',
      performed_by: profile.id,
      resource_type: 'funding_partners',
      resource_id: partner.id,
    }),
  ]);

  return NextResponse.json({ success: true, partner, emailSent, warning: inviteWarning });
}
