import type { SupabaseClient } from '@supabase/supabase-js';

type ReadinessCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail?: string;
};

export type DealReadinessResult = {
  canSubmitToLender: boolean;
  checks: ReadinessCheck[];
};

const LAST4_PATTERN = /^\d{4}$/;

function normalizeDigits(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
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

  const [docsRes, appRes, businessRes, ownerRes, uwRes] = await Promise.all([
    supabase
      .from('document_requests')
      .select('id,label,required,status')
      .eq('organization_id', organizationId)
      .eq('deal_id', dealId)
      .eq('required', true),
    applicationId
      ? supabase
        .from('applications')
        .select('id,signed_name,signature_date')
        .eq('organization_id', organizationId)
        .eq('id', applicationId)
        .maybeSingle()
      : Promise.resolve({ data: null } as any),
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
  const openRequired = requiredDocRows.filter((row: any) => !['approved', 'waived'].includes(row.status));
  const hasSignature = Boolean(appRes.data?.signed_name || appRes.data?.signature_date);
  const einLast4 = normalizeDigits(businessRes.data?.ein_last4 || '');
  const owner = (ownerRes.data || [])[0] as any;
  const ssnLast4 = normalizeDigits(owner?.owners?.ssn_last4 || '');
  const underwritingCompleted = Boolean(uwRes.data?.status === 'completed' && uwRes.data?.decision && uwRes.data.decision !== 'pending');

  const checks: ReadinessCheck[] = [
    {
      key: 'required_documents_complete',
      label: 'Required checklist documents complete',
      passed: openRequired.length === 0,
      detail: openRequired.length ? `${openRequired.length} required checklist item(s) still open.` : 'All required checklist items are approved or waived.',
    },
    {
      key: 'signature_captured',
      label: 'Application signature captured',
      passed: hasSignature,
      detail: hasSignature ? 'Signature metadata is present on the application.' : 'No signature metadata found on the application.',
    },
    {
      key: 'ein_verified',
      label: 'Business EIN appears complete',
      passed: LAST4_PATTERN.test(einLast4),
      detail: LAST4_PATTERN.test(einLast4) ? 'EIN last4 is present for controlled workflows.' : 'EIN last4 is missing. Verify business EIN before lender submission.',
    },
    {
      key: 'ssn_present',
      label: 'Owner SSN appears present',
      passed: LAST4_PATTERN.test(ssnLast4),
      detail: LAST4_PATTERN.test(ssnLast4) ? 'Owner SSN last4 is present for controlled workflows.' : 'Owner SSN last4 is missing. Verify owner SSN before lender submission.',
    },
    {
      key: 'underwriting_completed',
      label: 'Underwriting review completed',
      passed: underwritingCompleted,
      detail: underwritingCompleted ? 'Latest underwriting review is completed with a decision.' : 'Latest underwriting review is missing or incomplete.',
    },
  ];

  const failed = checks.filter((check) => !check.passed);
  return {
    canSubmitToLender: failed.length === 0 || Boolean(allowAdminOverride),
    checks,
    failed,
  };
}
