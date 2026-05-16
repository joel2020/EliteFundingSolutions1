export const CRM_STAGES = [
  'lead_captured',
  'documents_requested',
  'application_submitted',
  'underwriting_review',
  'submitted_to_partners',
  'offers_received',
  'offer_presented',
  'contract_sent',
  'contract_signed',
  'funded',
  'declined',
  'lost_unresponsive',
  'renewal_eligible',
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];

export type StageTransitionContext = {
  fromStage?: string | null;
  toStage: string;
  role: string;
  acceptedOfferCount?: number;
  openRequiredDocumentCount?: number;
  fundedAmount?: number | null;
};

const TERMINAL_STAGES = new Set(['funded', 'declined', 'lost_unresponsive']);
const MANAGER_ROLES = new Set(['super_admin', 'admin', 'manager']);
const FUNDING_ROLES = new Set(['super_admin', 'admin', 'manager', 'processor']);

const allowedTransitions: Record<string, string[]> = {
  lead_captured: ['documents_requested', 'application_submitted', 'declined', 'lost_unresponsive'],
  documents_requested: ['application_submitted', 'underwriting_review', 'declined', 'lost_unresponsive'],
  application_submitted: ['documents_requested', 'underwriting_review', 'declined', 'lost_unresponsive'],
  underwriting_review: ['documents_requested', 'submitted_to_partners', 'offers_received', 'declined', 'lost_unresponsive'],
  submitted_to_partners: ['offers_received', 'offer_presented', 'declined', 'lost_unresponsive'],
  offers_received: ['submitted_to_partners', 'offer_presented', 'contract_sent', 'declined', 'lost_unresponsive'],
  offer_presented: ['offers_received', 'contract_sent', 'declined', 'lost_unresponsive'],
  contract_sent: ['offer_presented', 'contract_signed', 'declined', 'lost_unresponsive'],
  contract_signed: ['contract_sent', 'funded', 'declined'],
  renewal_eligible: ['funded', 'lost_unresponsive'],
};

export function isCrmStage(value?: string | null): value is CrmStage {
  return !!value && CRM_STAGES.includes(value as CrmStage);
}

export function validateStageTransition(context: StageTransitionContext) {
  const fromStage = context.fromStage || 'lead_captured';
  const toStage = context.toStage;

  if (!isCrmStage(toStage)) {
    return { ok: false, error: 'Unknown deal stage.' };
  }

  if (fromStage === toStage) {
    return { ok: true };
  }

  if (TERMINAL_STAGES.has(fromStage) && !MANAGER_ROLES.has(context.role)) {
    return { ok: false, error: 'Only managers can reopen or change terminal deals.' };
  }

  if (!MANAGER_ROLES.has(context.role)) {
    const allowed = allowedTransitions[fromStage] || [];
    if (!allowed.includes(toStage)) {
      return { ok: false, error: `Invalid stage transition from ${fromStage} to ${toStage}.` };
    }
  }

  if (toStage === 'contract_sent' && Number(context.acceptedOfferCount || 0) < 1) {
    return { ok: false, error: 'An accepted offer is required before sending contracts.' };
  }

  if (toStage === 'funded') {
    if (!FUNDING_ROLES.has(context.role)) {
      return { ok: false, error: 'Only managers, admins, and processors can mark a deal funded.' };
    }
    if (Number(context.acceptedOfferCount || 0) < 1) {
      return { ok: false, error: 'An accepted offer is required before funding.' };
    }
    if (Number(context.openRequiredDocumentCount || 0) > 0) {
      return { ok: false, error: 'Required funding documents must be approved or waived before funding.' };
    }
    if (!context.fundedAmount || context.fundedAmount <= 0) {
      return { ok: false, error: 'Funded amount must be set before funding.' };
    }
  }

  return { ok: true };
}
