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

  test('keeps deterministic blockers and redacts sensitive text from AI output', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    process.env.AZURE_OPENAI_RESPONSES_URL = 'https://azure-openai.test/responses';
    delete process.env.AZURE_OPENAI_CHAT_COMPLETIONS_URL;
    delete process.env.OPENAI_API_KEY;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          summary: 'Atlas Retail owner SSN is 123-45-6789 and EIN is 12-3456789.',
          fundingReadiness: 'Ready to send.',
          riskFlags: ['No risk; SSN 123456789 reviewed.'],
          missingItems: [],
          recommendedNextActions: ['Send to funders now.'],
          funderEmailDraft: { subject: 'Atlas Retail package', body: 'Tax ID 12-3456789 is in the file.' },
          questionsForMerchant: [],
          confidence: 'high',
          applicationQa: {
            status: 'ready',
            score: 100,
            blockers: [],
            warnings: [],
            verifiedFields: ['All fields'],
            fixes: [],
          },
          documentIntelligence: {
            status: 'ready',
            documentsReviewed: [],
            extractedSignals: [],
            missingDocumentTypes: [],
            bankStatementAnalysis: {
              status: 'Looks complete',
              monthlyRevenue: '$120,000',
              negativeDays: '0',
              nsfCount: '0',
              notes: [],
            },
          },
          funderMatches: [{
            fundingPartnerId: 'partner-1',
            name: 'Apex Business Funding',
            score: 100,
            reasons: ['Perfect fit'],
            warnings: [],
            missingRequirements: [],
            submissionRoute: 'submissions@apex.test',
          }],
          packageBuilder: {
            status: 'ready',
            readyToSend: true,
            includedDocumentIds: ['doc-bank'],
            requiredDocumentTypes: ['completed_application', 'bank_statements', 'drivers_license', 'voided_check'],
            missingDocumentTypes: [],
            warnings: [],
            emailSubject: 'Atlas Retail package',
            emailBody: 'Send with SSN 123-45-6789.',
          },
          copilot: {
            answer: 'Ready with SSN 123-45-6789.',
            suggestedQuestions: [],
            sourceNotes: [],
          },
        }),
      }),
    })) as unknown as typeof fetch;

    let result;
    try {
      result = await generateCrmAiAnalysis({
        deal: { id: 'deal-1', title: 'Atlas Retail', requested_amount: 75000, stage_slug: 'underwriting_review' },
        business: { legal_name: 'Atlas Retail LLC', monthly_gross_revenue: 125000, state: 'NY', industry: 'retail' },
        application: { requested_amount: 75000 },
        owners: [{ first_name: 'Jordan', last_name: 'Lee' }],
        documents: [
          { id: 'doc-bank', document_type: 'bank_statements', status: 'uploaded', file_name: 'atlas-bank.pdf' },
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
      delete process.env.AZURE_OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_RESPONSES_URL;
    }

    expect(result.provider).toBe('azure-openai');
    expect(result.analysis.applicationQa.status).toBe('blocked');
    expect(result.analysis.applicationQa.blockers).toEqual(expect.arrayContaining(['Signature missing', 'Owner SSN evidence missing']));
    expect(result.analysis.packageBuilder.readyToSend).toBe(false);
    expect(result.analysis.packageBuilder.status).toBe('blocked');
    expect(result.analysis.packageBuilder.missingDocumentTypes).toEqual(expect.arrayContaining(['completed_application', 'drivers_license', 'voided_check']));
    expect(result.analysis.funderMatches[0].missingRequirements).toEqual(expect.arrayContaining(['completed application', 'drivers license', 'voided check']));
    expect(JSON.stringify(result.analysis)).not.toContain('123-45-6789');
    expect(JSON.stringify(result.analysis)).not.toContain('123456789');
    expect(JSON.stringify(result.analysis)).not.toContain('12-3456789');
  });
});
