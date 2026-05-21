'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const INTERNAL_CRM_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'sales_rep',
  'processor',
  'underwriter',
] as const;

export type InternalCrmRole = (typeof INTERNAL_CRM_ROLES)[number];

export type CrmProfile = {
  id: string;
  user_id: string;
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
};

export function isInternalCrmRole(role?: string | null): role is InternalCrmRole {
  return !!role && INTERNAL_CRM_ROLES.includes(role as InternalCrmRole);
}

export async function getCrmProfile(): Promise<{ profile: CrmProfile | null; error: string | null }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) return { profile: null, error: userError.message };
  if (!user) return { profile: null, error: 'Please sign in to access the CRM.' };

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id,user_id,organization_id,email,first_name,last_name,role,is_active')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { profile: null, error: error.message };
  if (!profile) return { profile: null, error: 'No CRM profile is linked to this user. Contact an administrator.' };
  if (!profile.is_active) return { profile: null, error: 'Your CRM profile is inactive. Contact an administrator.' };
  if (!isInternalCrmRole(profile.role)) return { profile: null, error: 'Your role is not allowed to access the CRM.' };

  return { profile: profile as CrmProfile, error: null };
}

export async function requireInternalCrmRole(roles: readonly string[] = INTERNAL_CRM_ROLES) {
  const result = await getCrmProfile();

  if (!result.profile) return result;
  if (!roles.includes(result.profile.role)) {
    return { profile: null, error: 'You do not have permission to perform this CRM action.' };
  }

  return result;
}

export function useCrmUser() {
  const [profile, setProfile] = useState<CrmProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    getCrmProfile().then((result) => {
      if (!mounted) return;
      setProfile(result.profile);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { profile, organizationId: profile?.organization_id ?? null, loading, error };
}
