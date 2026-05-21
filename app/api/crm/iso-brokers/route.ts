import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmProfile, requireSameOrigin } from '@/lib/server-auth';
import { sendEmail, emailTemplates } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WRITE_ROLES = ['super_admin', 'admin', 'manager'];
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

const optionalText = z.preprocess(
  (value) => (value == null ? '' : value),
  z.string().trim().optional().default(''),
);

const optionalEmail = z.preprocess(
  (value) => (value == null ? '' : value),
  z.string().trim().email('Enter a valid email.').or(z.literal('')).default(''),
);

const brokerSchema = z.object({
  company_name: z.string().trim().min(1, 'Company name is required.'),
  broker_name: z.string().trim().min(1, 'Broker name is required.'),
  email: optionalEmail,
  phone: optionalText,
  commission_pct: z.coerce.number().min(0).max(100).default(5),
  payment_terms: optionalText,
  notes: optionalText,
});

function slugifyBroker(companyName: string, brokerName: string) {
  const base = [companyName, brokerName].filter(Boolean).join('-') || 'iso-broker';
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 72);
  return slug || 'iso-broker';
}

function applicationSlugForBroker(broker: { id: string; company_name?: string | null; broker_name?: string | null }) {
  return `${slugifyBroker(broker.company_name || '', broker.broker_name || '')}-${broker.id.slice(0, 8)}`;
}

function isMissingApplicationSlugColumn(error: { code?: string; message?: string }) {
  const message = (error.message || '').toLowerCase();
  return error.code === 'PGRST204' || (message.includes('application_slug') && (message.includes('schema cache') || message.includes('column')));
}

export async function GET() {
  const auth = await requireCrmProfile();
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const [brokerResult, commissionResult, dealResult] = await Promise.all([
    supabase.from('iso_brokers').select('*').eq('organization_id', profile.organization_id).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('commissions').select('id,iso_broker_id,deal_id,commission_amount,payment_status').eq('organization_id', profile.organization_id),
    supabase.from('deals').select('id,stage_slug,funded_at,funded_amount').eq('organization_id', profile.organization_id).is('deleted_at', null),
  ]);

  if (brokerResult.error) {
    return NextResponse.json({ success: false, error: brokerResult.error.message }, { status: 500, headers: noStoreHeaders });
  }

  let brokers = brokerResult.data || [];
  const brokersMissingSlugs = brokers.filter((broker: any) => !broker.application_slug);
  if (brokersMissingSlugs.length) {
    const repaired = await Promise.allSettled(brokersMissingSlugs.map((broker: any) => {
      const application_slug = applicationSlugForBroker(broker);
      return supabase
        .from('iso_brokers')
        .update({ application_slug })
        .eq('id', broker.id)
        .eq('organization_id', profile.organization_id)
        .select('*')
        .single();
    }));

    const repairedById = new Map<string, any>();
    for (const item of repaired) {
      if (item.status === 'fulfilled' && !item.value.error && item.value.data) {
        repairedById.set(item.value.data.id, item.value.data);
      }
    }
    brokers = brokers.map((broker: any) => repairedById.get(broker.id) || broker);
  }

  return NextResponse.json({
    success: true,
    brokers,
    commissions: commissionResult.data || [],
    deals: dealResult.data || [],
  }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;

  const auth = await requireCrmProfile(WRITE_ROLES);
  if ('response' in auth) return auth.response;
  const { user, profile, supabase } = auth;

  const parsed = brokerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid broker payload.', issues: parsed.error.flatten() }, { status: 400, headers: noStoreHeaders });
  }

  const form = parsed.data;
  const applicationSlug = `${slugifyBroker(form.company_name, form.broker_name)}-${Date.now().toString(36)}`;
  const payload = {
    organization_id: profile.organization_id,
    company_name: form.company_name,
    broker_name: form.broker_name,
    email: form.email || null,
    phone: form.phone || null,
    commission_pct: form.commission_pct,
    payment_terms: form.payment_terms || null,
    notes: form.notes || null,
    is_active: true,
    application_slug: applicationSlug,
  };

  let warning: string | null = null;
  let insertPayload: Record<string, unknown> = payload;
  let result = await supabase.from('iso_brokers').insert(insertPayload).select('*').single();

  if (result.error && isMissingApplicationSlugColumn(result.error)) {
    const { application_slug: _applicationSlug, ...fallbackPayload } = payload;
    insertPayload = fallbackPayload;
    result = await supabase.from('iso_brokers').insert(insertPayload).select('*').single();
    warning = 'Broker was added, but the application link column is not live in Supabase yet. Apply the ISO broker application links migration to enable broker links.';
  }

  if (result.error) {
    return NextResponse.json({ success: false, error: result.error.message }, { status: 500, headers: noStoreHeaders });
  }

  // If an email was provided, provision a Supabase auth account and send a branded invite via Resend
  let emailSent = false;
  let brokerAuthWarning: string | null = null;

  if (form.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectTo = `${appUrl}/set-password`;
    const firstName = form.broker_name.split(' ')[0] || form.broker_name;
    const lastName = form.broker_name.split(' ').slice(1).join(' ') || '';

    const invited = await supabase.auth.admin.generateLink({
      type: 'invite',
      email: form.email,
      options: {
        redirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          iso_broker_id: result.data.id,
          role: 'iso_broker',
        },
      },
    });

    const invitedUser = invited.data?.user;
    const inviteUrl = (invited.data as any)?.properties?.action_link;

    if (invited.error || !invitedUser || !inviteUrl) {
      // Auth invite failed (e.g. user already exists) — log but don't block broker creation
      const message = invited.error?.message || 'Unable to generate invite link.';
      brokerAuthWarning = `Broker record created but auth invite failed: ${message}`;
      console.error('Broker auth invite error:', message);
    } else {
      const { error: profileError } = await supabase.from('user_profiles').upsert({
        user_id: invitedUser.id,
        organization_id: profile.organization_id,
        email: form.email,
        first_name: firstName,
        last_name: lastName,
        role: 'iso_broker',
        permissions: [],
        is_active: true,
        created_by: profile.id,
        updated_by: profile.id,
      }, { onConflict: 'user_id,organization_id' });

      if (profileError) {
        brokerAuthWarning = `Broker invite created but portal profile failed: ${profileError.message}`;
        console.error('Broker portal profile error:', profileError.message);
      } else {

      const emailResult = await sendEmail({
        to: form.email,
        subject: `You've been added as an ISO/Broker Partner — Elite Funding Solutions`,
        html: emailTemplates.brokerInvite(
          form.broker_name,
          form.company_name,
          inviteUrl,
        ),
      });

      emailSent = emailResult.success;
      if (!emailResult.success) {
        console.error('Broker invite email failed:', emailResult.error);
      }
      }
    }
  }

  await Promise.allSettled([
    supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'iso_broker_created',
      resource_type: 'iso_brokers',
      resource_id: result.data.id,
      new_data: insertPayload,
    }),
    supabase.from('activities').insert({
      organization_id: profile.organization_id,
      activity_type: 'system',
      title: 'ISO broker created',
      body: `${form.company_name} was added as an ISO / broker partner.`,
      direction: 'internal',
      performed_by: profile.id,
      resource_type: 'iso_brokers',
      resource_id: result.data.id,
    }),
  ]);

  return NextResponse.json({
    success: true,
    broker: result.data,
    emailSent,
    warning: warning || brokerAuthWarning || undefined,
  }, { headers: noStoreHeaders });
}
