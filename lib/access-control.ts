export const INTERNAL_CRM_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'sales_rep',
  'processor',
  'underwriter',
] as const;

export const EXTERNAL_CRM_ROLES = [
  'funder',
  'iso_broker',
  'broker',
  'referral_partner',
  'viewer',
] as const;

export const CRM_ACCESS_ROLES = [
  ...INTERNAL_CRM_ROLES,
  ...EXTERNAL_CRM_ROLES,
] as const;

export type InternalCrmRole = (typeof INTERNAL_CRM_ROLES)[number];
export type CrmAccessRole = (typeof CRM_ACCESS_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  sales_rep: 'Internal Team Member',
  processor: 'Processor',
  underwriter: 'Underwriter',
  funder: 'Funder',
  iso_broker: 'ISO Partner',
  broker: 'Broker',
  referral_partner: 'Referral Partner',
  viewer: 'Read-only User',
  client: 'Client',
};

export function isInternalCrmRole(role?: string | null): role is InternalCrmRole {
  return !!role && INTERNAL_CRM_ROLES.includes(role as InternalCrmRole);
}

export function isCrmAccessRole(role?: string | null): role is CrmAccessRole {
  return !!role && CRM_ACCESS_ROLES.includes(role as CrmAccessRole);
}

export function accessEntityTypeForRole(role: string) {
  if (role === 'funder') return 'funding_partner';
  if (role === 'iso_broker' || role === 'broker' || role === 'referral_partner') return 'iso_broker';
  return 'internal';
}
