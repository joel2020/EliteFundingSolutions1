'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) return { profile: null, error: userError.message };
  if (!user) return { profile: null, error: 'Please sign in to access the CRM.' };

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('id,user_id,organization_id,email,first_name,last_name,role,permissions,access_entity_type,access_entity_id,is_active')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { profile: null, error: error.message };
  if (!profile) return { profile: null, error: 'No CRM profile is linked to this user. Contact an administrator.' };
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
