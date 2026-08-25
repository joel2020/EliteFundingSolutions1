'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CRM_ACCESS_ROLES, type InternalCrmRole } from '@/lib/access-control';

export type CrmProfile = {
  id: string;
  user_id: string;
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

export async function getCrmProfile(): Promise<{ profile: CrmProfile | null; error: string | null }> {
  const response = await fetch('/api/crm/me', { cache: 'no-store' });
  const result = await response.json().catch(() => null);
  const profile = result?.profile;

  if (!response.ok || !result?.success) {
    return { profile: null, error: result?.error || 'Please sign in to access the CRM.' };
  }

  if (!profile.is_active) return { profile: null, error: 'Your CRM profile is inactive. Contact an administrator.' };
  if (!CRM_ACCESS_ROLES.includes(profile.role as any)) return { profile: null, error: 'Your role is not allowed to access the CRM.' };

  return { profile: profile as CrmProfile, error: null };
}

export async function requireInternalCrmRole(roles: readonly string[] = CRM_ACCESS_ROLES) {
  const result = await getCrmProfile();

  if (!result.profile) return result;
  if (!roles.includes(result.profile.role)) {
    return { profile: null, error: 'You do not have permission to perform this CRM action.' };
  }

  return result;
}

export function useCrmUser() {
  const mounted = useRef(false);
  const [profile, setProfile] = useState<CrmProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const result = await getCrmProfile().catch(() => ({
      profile: null,
      error: 'Unable to load your CRM profile.',
    }));
    if (!mounted.current) return result;
    setProfile(result.profile);
    setError(result.error);
    setLoading(false);
    return result;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadProfile();

    return () => {
      mounted.current = false;
    };
  }, [loadProfile]);

  return { profile, organizationId: profile?.organization_id ?? null, loading, error, refetch: loadProfile };
}
