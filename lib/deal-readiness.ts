import type { SupabaseClient } from '@supabase/supabase-js';

type ReadinessCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail?: string;
  blocksSubmission?: boolean;
};

export type DealReadinessResult = {
  canSubmitToLender: boolean;
  checks: ReadinessCheck[];
};

const LAST4_PATTERN = /^\d{4}$/;
const COMPLETE_REQUIRED_DOCUMENT_STATUSES = new Set(['uploaded', 'in_review', 'approved', 'waived']);
const SIGNED_APPLICATION_STATUSES = new Set(['signed', 'completed', 'converted']);

function normalizeDigits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

export function isRequiredDocumentCompleteStatus(status: string | null | undefined) {
  return COMPLETE_REQUIRED_DOCUMENT_STATUSES.has(String(status || '').toLowerCase());
}

export function isSubmissionBlockingReadinessCheck(check: ReadinessCheck) {
  return !check.passed && check.blocksSubmission !== false;
}

export function hasApplicationSignatureEvidence(args: {
  application?: Record<string, any> | null;
  completedApplicationDocuments?: Array<Record<string, any>>;
}) {
  const application = args.application || {};
  const payload = application.application_payload || {};
  const hasCompletedApplicationDocument = (args.completedApplicationDocuments || []).some((document) =>
    document?.document_type === 'completed_application' &&
    isRequiredDocumentCompleteStatus(document.status)
  );
  const hasSignedStatus = SIGNED_APPLICATION_STATUSES.has(String(application.signature_status || '').toLowerCase());
  const hasStoredDrawnSignature = Boolean(application.signature_data_storage_path);
  const hasSignedApplicationDocument = Boolean(application.signed_application_document_id);
  const hasSignatureNameAndDate = Boolean(
    (application.signed_name || application.e_signature || payload.signature) &&
    (application.signature_date || payload.signature_date)
  );

  return Boolean(
    (hasSignedApplicationDocument && hasSignatureNameAndDate) ||
    (hasSignedStatus && hasStoredDrawnSignature) ||
    (hasCompletedApplicationDocument && hasSignatureNameAndDate)
  );
}

export async function evaluateDealReadinessForLenderSubmission(args: {
  supabase: SupabaseClient;
  organizationId: string;
  dealId: string;
  applicationId?: string | null;
  businessId?: string | null;
  allowAdminOverride?: boolean;
}) {
  const { supabase, organizationId, dealId, applicationId, businessId, allowAdminOverride } = args;

  const completedApplicationQuery = applicationId
    ? supabase
      .from('documents')
      .select('id,document_type,status,deal_id,application_id')
      .eq('organization_id', organizationId)
      .or(`deal_id.eq.${dealId},application_id.eq.${applicationId}`)
      .eq('document_type', 'completed_application')
      .limit(10)
    : supabase
      .from('documents')
      .select('id,document_type,status,deal_id,application_id')
      .eq('organization_id', organizationId)
      .eq('deal_id', dealId)
      .eq('document_type', 'completed_application')
      .limit(10);

  const [docsRes, appRes, completedAppDocsRes, businessRes, ownerRes, uwRes] = await Promise.all([
    supabase
      .from('document_requests')
      .select('id,label,required,status')
      .eq('organization_id', organizationId)
      .eq('deal_id', dealId)
      .eq('required', true),
    applicationId
      ? supabase
        .from('applications')
        .select('id,signed_name,e_signature,signature_date,signature_status,signature_data_storage_path,signed_application_document_id,application_payload')
        .eq('organization_id', organizationId)
        .eq('id', applicationId)
        .maybeSingle()
      : Promise.resolve({ data: null } as any),
    completedApplicationQuery,
    businessId
      ? supabase
        .from('businesses')
        .select('id,ein_encrypted,ein_last4')
        .eq('organization_id', organizationId)
        .eq('id', businessId)
        .maybeSingle()
      : Promise.resolve({ data: null } as any),
    businessId
      ? supabase
        .from('business_owners')
        .select('owners(ssn_encrypted,ssn_last4)')
        .eq('organization_id', organizationId)
        .eq('business_id', businessId)
        .limit(1)
      : Promise.resolve({ data: [] } as any),
    supabase
      .from('underwriting_reviews')
      .select('id,status,decision')
      .eq('organization_id', organizationId)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const requiredDocRows = docsRes.data || [];
  const openRequired = requiredDocRows.filter((row: any) => !isRequiredDocumentCompleteStatus(row.status));
  const hasSignature = hasApplicationSignatureEvidence({
    application: appRes.data,
    completedApplicationDocuments: completedAppDocsRes.data || [],
  });
  const einLast4 = normalizeDigits(businessRes.data?.ein_last4 || '');
  const owner = (ownerRes.data || [])[0] as any;
  const ssnLast4 = normalizeDigits(owner?.owners?.ssn_last4 || '');
  const underwritingCompleted = Boolean(uwRes.data?.status === 'completed' && uwRes.data?.decision && uwRes.data.decision !== 'pending');

  const checks: ReadinessCheck[] = [
    {
      key: 'required_documents_complete',
      label: 'Required checklist documents complete',
      passed: openRequired.length === 0,
      blocksSubmission: true,
      detail: openRequired.length ? `${openRequired.length} required checklist item(s) still missing or needs replacement.` : 'All required checklist items are uploaded, in review, approved, or waived.',
    },
    {
      key: 'signature_captured',
      label: 'Application signature captured',
      passed: hasSignature,
      blocksSubmission: true,
      detail: hasSignature ? 'Signed or converted application evidence is attached to the deal.' : 'No completed signed application or stored signature evidence found on the deal.',
    },
    {
      key: 'ein_verified',
      label: 'Business EIN appears complete',
      passed: LAST4_PATTERN.test(einLast4),
      blocksSubmission: true,
      detail: LAST4_PATTERN.test(einLast4) ? 'EIN last4 is present for controlled workflows.' : 'EIN last4 is missing. Verify business EIN before lender submission.',
    },
    {
      key: 'ssn_present',
      label: 'Owner SSN appears present',
      passed: LAST4_PATTERN.test(ssnLast4),
      blocksSubmission: true,
      detail: LAST4_PATTERN.test(ssnLast4) ? 'Owner SSN last4 is present for controlled workflows.' : 'Owner SSN last4 is missing. Verify owner SSN before lender submission.',
    },
    {
      key: 'underwriting_completed',
      label: 'Underwriting review completed',
      passed: underwritingCompleted,
      blocksSubmission: false,
      detail: underwritingCompleted ? 'Latest underwriting review is completed with a decision.' : 'Latest underwriting review is missing or incomplete.',
    },
  ];

  const failed = checks.filter((check) => !check.passed);
  const blockingFailed = checks.filter(isSubmissionBlockingReadinessCheck);
  return {
    canSubmitToLender: blockingFailed.length === 0 || Boolean(allowAdminOverride),
    checks,
    failed,
    blockingFailed,
  };
}
