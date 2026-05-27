export const INTERNAL_CRM_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'sales_rep',
  'processor',
  'underwriter',
  'funder',
  'iso_broker',
  'broker',
  'referral_partner',
  'viewer',
] as const;

export type InternalCrmRole = (typeof INTERNAL_CRM_ROLES)[number];

export function isInternalCrmRole(role?: string | null): role is InternalCrmRole {
  return !!role && INTERNAL_CRM_ROLES.includes(role as InternalCrmRole);
}

export function safeRedirectPath(path: string | null, fallback = '/crm') {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback;
  return path;
}

export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_CRM_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function getCrmInviteRedirectUrl() {
  return `${getAppBaseUrl()}/auth/callback?next=/crm`;
}
