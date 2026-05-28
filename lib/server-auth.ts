import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createServiceSupabaseClient, DEFAULT_ORG_ID } from '@/lib/server-supabase';
import { INTERNAL_CRM_ROLES } from '@/lib/auth-routing';
export { INTERNAL_CRM_ROLES } from '@/lib/auth-routing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mdrrcrmowurbrwvdsgnq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key-for-build';
const supabaseProjectRef = new URL(supabaseUrl).hostname.split('.')[0];

export type ServerCrmProfile = {
  id: string;
  user_id: string | null;
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  permissions?: string[];
  is_active: boolean;
};

export function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return null;

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

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function extractAccessTokenFromSupabaseCookies(cookieList: { name: string; value: string }[]) {
  const baseName = `sb-${supabaseProjectRef}-auth-token`;
  const matchingCookies = cookieList
    .filter((cookie) => cookie.name === baseName || cookie.name.startsWith(`${baseName}.`))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (!matchingCookies.length) return null;

  const rawValue = matchingCookies.map((cookie) => cookie.value).join('');
  const sessionValue = rawValue.startsWith('base64-') ? decodeBase64Url(rawValue.slice('base64-'.length)) : rawValue;

  try {
    const parsed = JSON.parse(sessionValue) as { access_token?: unknown };
    return typeof parsed.access_token === 'string' ? parsed.access_token : null;
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(): Promise<{ user: User | null; error: string | null }> {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return allCookies;
      },
      setAll() {
        // API routes in this app do not mutate auth cookies.
      },
    },
  });

  const { data, error } = await authClient.auth.getUser();
  if (data.user) return { user: data.user, error: null };

  const cookieAccessToken = extractAccessTokenFromSupabaseCookies(allCookies);
  if (cookieAccessToken) {
    const fallback = await authClient.auth.getUser(cookieAccessToken);
    if (fallback.data.user) return { user: fallback.data.user, error: null };
  }

  if (error || !data.user) return { user: null, error: 'Unauthorized' };
  return { user: data.user, error: null };
}

export async function requireCrmProfile(roles: readonly string[] = INTERNAL_CRM_ROLES) {
  const { user, error } = await getAuthenticatedUser();
  if (!user) return { response: jsonError(error || 'Unauthorized', 401) };

  const supabase = createServiceSupabaseClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id,user_id,organization_id,email,first_name,last_name,role,permissions,is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
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
    .select('id,user_id,organization_id,email,first_name,last_name,role,permissions,is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!profile || profile.role !== 'client') {
    return { response: jsonError('Forbidden', 403) };
  }

  return { user, profile: profile as ServerCrmProfile, supabase };
}

export async function getPortalApplicationIds(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  user: User,
  organizationId = DEFAULT_ORG_ID,
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

  return Array.from(ids);
}
