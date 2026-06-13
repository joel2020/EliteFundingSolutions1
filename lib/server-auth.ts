import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';
import { CRM_ACCESS_ROLES, INTERNAL_CRM_ROLES } from '@/lib/access-control';

export { INTERNAL_CRM_ROLES };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';
const PORTAL_ROLES = ['client', 'iso_broker'] as const;

export type ServerCrmProfile = {
  id: string;
  user_id: string | null;
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions?: string[];
  access_entity_type?: string | null;
  access_entity_id?: string | null;
  is_active: boolean;
};

export function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  // These routes are only ever called by the in-browser SPA, where a same-origin
  // request always carries an Origin header. A missing Origin means a non-browser
  // client (curl/Postman/server) and is treated as a CSRF failure.
  if (!origin) return jsonError('Forbidden', 403);

  const host = request.headers.get('host');
  if (!host) return jsonError('Forbidden', 403);

  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) return jsonError('Forbidden', 403);
  } catch {
    return jsonError('Forbidden', 403);
  }

  return null;
}

export async function getAuthenticatedUser(): Promise<{ user: User | null; error: string | null }> {
  const cookieStore = cookies();
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // API routes in this app do not mutate auth cookies.
      },
    },
  });

  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return { user: null, error: 'Unauthorized' };
  return { user: data.user, error: null };
}

export async function requireCrmProfile(roles: readonly string[] = INTERNAL_CRM_ROLES) {
  const { user, error } = await getAuthenticatedUser();
  if (!user) return { response: jsonError(error || 'Unauthorized', 401) };

  const supabase = createServiceSupabaseClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id,user_id,organization_id,email,first_name,last_name,role,permissions,access_entity_type,access_entity_id,is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (!profile || !roles.includes(profile.role)) {
    return { response: jsonError('Forbidden', 403) };
  }

  return { user, profile: profile as ServerCrmProfile, supabase };
}

export async function requirePortalProfile() {
  const { user, error } = await getAuthenticatedUser();
  if (!user) return { response: jsonError(error || 'Unauthorized', 401) };

  const supabase = createServiceSupabaseClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id,user_id,organization_id,email,first_name,last_name,role,permissions,access_entity_type,access_entity_id,is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (!profile || !PORTAL_ROLES.includes(profile.role as (typeof PORTAL_ROLES)[number])) {
    return { response: jsonError('Forbidden', 403) };
  }

  return { user, profile: profile as ServerCrmProfile, supabase };
}

export async function getPortalApplicationIds(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  user: User,
  organizationId = DEFAULT_ORG_ID,
  profile?: Pick<ServerCrmProfile, 'role' | 'email'> | null,
) {
  const email = user.email || '';
  const ids = new Set<string>();

  if (email) {
    const { data: leadApplications } = await supabase
      .from('applications')
      .select('id,leads!inner(email)')
      .eq('organization_id', organizationId)
      .eq('leads.email', email)
      .limit(100);

    (leadApplications || []).forEach((application: { id: string }) => ids.add(application.id));
  }

  const { data: owners } = await supabase
    .from('owners')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .is('deleted_at', null);

  const ownerIds = (owners || []).map((owner: { id: string }) => owner.id);
  if (ownerIds.length) {
    const { data: links } = await supabase
      .from('business_owners')
      .select('business_id')
      .eq('organization_id', organizationId)
      .in('owner_id', ownerIds);

    const businessIds = Array.from(new Set((links || []).map((link: { business_id: string }) => link.business_id)));
    if (businessIds.length) {
      const { data: businessApplications } = await supabase
        .from('applications')
        .select('id')
        .eq('organization_id', organizationId)
        .in('business_id', businessIds)
        .limit(100);

      (businessApplications || []).forEach((application: { id: string }) => ids.add(application.id));
    }
  }

  if (profile?.role === 'iso_broker' && email) {
    const { data: brokers } = await supabase
      .from('iso_brokers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('email', email)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(25);

    const brokerIds = (brokers || []).map((broker: { id: string }) => broker.id);
    if (brokerIds.length) {
      const { data: brokerApplications } = await supabase
        .from('applications')
        .select('id')
        .eq('organization_id', organizationId)
        .in('iso_broker_id', brokerIds)
        .limit(100);

      (brokerApplications || []).forEach((application: { id: string }) => ids.add(application.id));
    }
  }

  return Array.from(ids);
}

export async function requireCrmAccess(roles: readonly string[] = CRM_ACCESS_ROLES) {
  return requireCrmProfile(roles);
}
