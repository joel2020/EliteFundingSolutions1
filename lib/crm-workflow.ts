export const CRM_STAGES = [
  'documents_requested',
  'application_submitted',
  'approved',
  'declined',
  'contract_requested',
  'contract_signed',
  'funded',
  'defaulted',
  'renewal_eligible',
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  documents_requested: 'Docs needed',
  application_submitted: 'Submitted',
  approved: 'Approved',
  declined: 'Declined',
  contract_requested: 'Contracts requested',
  contract_signed: 'Contracts signed',
  funded: 'Funded',
  defaulted: 'Defaulted',
  renewal_eligible: 'Renewal eligible',
};

// Older deals may still carry slugs from the previous pipeline. Map them onto
// the nine stages Rohan approved so nothing displays or validates incorrectly.
export const LEGACY_STAGE_MAP: Record<string, CrmStage> = {
  lead_captured: 'documents_requested',
  application_started: 'documents_requested',
  documents_received: 'application_submitted',
  underwriting_review: 'application_submitted',
  verification: 'application_submitted',
  merchant_interview: 'application_submitted',
  submission: 'application_submitted',
  submitted_to_partners: 'application_submitted',
  working_deal: 'application_submitted',
  offers_received: 'approved',
  offer_presented: 'approved',
  approved_not_accepted: 'declined',
  contract_sent: 'contract_requested',
  in_funding: 'contract_signed',
  lost_unresponsive: 'declined',
  withdrawn: 'declined',
};

export function isCrmStage(value?: string | null): value is CrmStage {
  return !!value && CRM_STAGES.includes(value as CrmStage);
}

export function normalizeStageSlug(value?: string | null): CrmStage {
  if (isCrmStage(value)) return value;
  if (value && LEGACY_STAGE_MAP[value]) return LEGACY_STAGE_MAP[value];
  return 'documents_requested';
}

export type StageTransitionContext = {
  fromStage?: string | null;
  toStage: string;
  role: string;
  acceptedOfferCount?: number;
  openRequiredDocumentCount?: number;
  fundedAmount?: number | null;
};

const TERMINAL_STAGES = new Set<CrmStage>(['funded', 'declined', 'defaulted']);
const MANAGER_ROLES = new Set(['super_admin', 'admin', 'manager']);
const FUNDING_ROLES = new Set(['super_admin', 'admin', 'manager', 'processor', 'sales_rep', 'underwriter']);

export function validateStageTransition(context: StageTransitionContext) {
  const fromStage = normalizeStageSlug(context.fromStage);
  const toStage = context.toStage;

  if (!isCrmStage(toStage)) {
    return { ok: false, error: 'Unknown deal stage.' };
  }

  if (fromStage === toStage) {
    return { ok: true };
  }

  if (TERMINAL_STAGES.has(fromStage) && !MANAGER_ROLES.has(context.role)) {
    return { ok: false, error: 'Only managers and admins can reopen funded, declined, or defaulted deals.' };
  }

  if ((toStage === 'funded' || toStage === 'defaulted') && !FUNDING_ROLES.has(context.role)) {
    return { ok: false, error: 'Only managers, admins, and processors can mark a deal funded or defaulted.' };
  }

  return { ok: true };
}
