import { expect, test } from '@playwright/test';
import { isRequiredDocumentCompleteStatus } from '../lib/deal-readiness';
import { generateCrmAiAnalysis } from '../lib/crm-ai-engine';

test.describe('deal readiness and funder requirements', () => {
  test('treats uploaded required documents as complete for funder submission', () => {
    expect(isRequiredDocumentCompleteStatus('uploaded')).toBe(true);
    expect(isRequiredDocumentCompleteStatus('in_review')).toBe(true);
    expect(isRequiredDocumentCompleteStatus('approved')).toBe(true);
    expect(isRequiredDocumentCompleteStatus('waived')).toBe(true);
    expect(isRequiredDocumentCompleteStatus('requested')).toBe(false);
    expect(isRequiredDocumentCompleteStatus('needs_replacement')).toBe(false);
    expect(isRequiredDocumentCompleteStatus('rejected')).toBe(false);
  });

  test('uses saved funder required documents in AI package planning', async () => {
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_RESPONSES_URL;
    delete process.env.AZURE_OPENAI_CHAT_COMPLETIONS_URL;
    delete process.env.OPENAI_API_KEY;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('External AI disabled in tests.');
    }) as typeof fetch;

    let result;
    try {
      result = await generateCrmAiAnalysis({
        deal: { id: 'deal-1', title: 'Atlas Retail', requested_amount: 75000, stage_slug: 'underwriting_review' },
        business: { legal_name: 'Atlas Retail LLC', monthly_gross_revenue: 125000, state: 'NY', industry: 'retail' },
        application: {
          requested_amount: 75000,
          signed_name: 'Jordan Lee',
          signature_date: '2026-06-10',
          application_payload: {
            legal_name: 'Atlas Retail LLC',
            requested_amount: '75000',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            ein: '12-3456789',
            owner1: { first_name: 'Jordan', last_name: 'Lee', dob: '1985-04-10', ssn: '123-45-6789', ownership_pct: '100' },
          },
        },
        owners: [{ first_name: 'Jordan', last_name: 'Lee', dob: '1985-04-10', ssn_last4: '6789', ownership_percentage: '100' }],
        documents: [
          { id: 'doc-app', document_type: 'completed_application', status: 'uploaded', file_name: 'atlas-application.pdf' },
          { id: 'doc-bank', document_type: 'bank_statements', status: 'uploaded', file_name: 'atlas-bank.pdf' },
          { id: 'doc-id', document_type: 'drivers_license', status: 'uploaded', file_name: 'atlas-id.pdf' },
          { id: 'doc-check', document_type: 'voided_check', status: 'uploaded', file_name: 'voided-check.pdf' },
        ],
        documentRequests: [],
        fundingPartners: [{
          id: 'partner-1',
          name: 'Apex Business Funding',
          submission_email: 'submissions@apex.test',
          required_documents: ['completed_application', 'bank_statements', 'drivers_license', 'voided_check'],
          product_types: ['MCA'],
          is_active: true,
        }],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(result.provider).toBe('rules');
    expect(result.analysis.packageBuilder.requiredDocumentTypes).toEqual(expect.arrayContaining(['voided_check']));
    expect(result.analysis.packageBuilder.includedDocumentIds).toEqual(expect.arrayContaining(['doc-check']));
    expect(result.analysis.packageBuilder.missingDocumentTypes).not.toContain('voided_check');
  });
});
