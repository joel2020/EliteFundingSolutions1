import { supabase, DEFAULT_ORG_ID } from './supabase';

/**
 * Authentication helper functions
 */

/**
 * Creates a user profile after signup
 */
export async function createUserProfile(userId: string, email: string, firstName?: string, lastName?: string) {
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingProfile) {
    return { success: true, profile: existingProfile };
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .insert({
      user_id: userId,
      organization_id: DEFAULT_ORG_ID,
      email,
      first_name: firstName || '',
      last_name: lastName || '',
      role: 'sales_rep',
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user profile:', error);
    return { success: false, error };
  }

  return { success: true, profile };
}

/**
 * Gets the current user's profile
 */
export async function getCurrentUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return profile;
}

/**
 * Checks if user has required role
 */
export async function hasRole(requiredRoles: string[]) {
  const profile = await getCurrentUserProfile();
  if (!profile) return false;
  return requiredRoles.includes(profile.role);
}

/**
 * Gets user's organization
 */
export async function getUserOrganization() {
  const profile = await getCurrentUserProfile();
  if (!profile) return null;

  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .single();

  return org;
}
