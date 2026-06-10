import { expect, test } from '@playwright/test';
import { classifyDealDocumentUpload, sameCrmDocumentType } from '../lib/document-classification';

test.describe('CRM document classification aliases', () => {
  test.afterEach(() => {
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_RESPONSES_URL;
    delete process.env.AI_PROVIDER;
  });

  test('matches common funder requirement wording to CRM document types', () => {
    expect(sameCrmDocumentType('drivers_license', 'owner ID')).toBe(true);
    expect(sameCrmDocumentType('license_verification', 'photo id')).toBe(true);
    expect(sameCrmDocumentType('tax_return', 'tax documents')).toBe(true);
    expect(sameCrmDocumentType('bank_statements', 'month-to-date bank statement')).toBe(true);
    expect(sameCrmDocumentType('voided_check', 'bank letter')).toBe(true);
    expect(sameCrmDocumentType('payoff_letter', 'payoff statement')).toBe(true);
    expect(sameCrmDocumentType('advance_statements', 'MCA balance letter')).toBe(true);
    expect(sameCrmDocumentType('ar_report', 'A/R aging report')).toBe(true);
    expect(sameCrmDocumentType('ar_report', 'accounts receivable')).toBe(true);
  });

  test('links classified uploads to open requests that use funder wording aliases', async () => {
    const bankStatement = await classifyDealDocumentUpload({
      fileName: 'june-mtd-statement.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.4 mtd bank statement'),
      requests: [{ id: 'request-mtd', document_type: 'month_to_date_bank_statement', label: 'MTD bank statement', status: 'requested' }],
    });
    expect(bankStatement.document_type).toBe('bank_statements');
    expect(bankStatement.matched_request_id).toBe('request-mtd');
    expect(bankStatement.label).toBe('MTD bank statement');

    const ownerId = await classifyDealDocumentUpload({
      fileName: 'owner-id.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.4 owner id'),
      requests: [{ id: 'request-owner-id', document_type: 'owner_id', label: 'Owner ID', status: 'requested' }],
    });
    expect(ownerId.document_type).toBe('drivers_license');
    expect(ownerId.matched_request_id).toBe('request-owner-id');

    const taxDocs = await classifyDealDocumentUpload({
      fileName: 'business-tax-return.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.4 tax return'),
      requests: [{ id: 'request-tax-docs', document_type: 'tax_documents', label: 'Tax documents', status: 'requested' }],
    });
    expect(taxDocs.document_type).toBe('tax_return');
    expect(taxDocs.matched_request_id).toBe('request-tax-docs');

    const arReport = await classifyDealDocumentUpload({
      fileName: 'ar-aging-report.pdf',
      mimeType: 'application/pdf',
      bytes: Buffer.from('%PDF-1.4 accounts receivable aging'),
      requests: [{ id: 'request-ar', document_type: 'accounts_receivable', label: 'A/R aging report', status: 'requested' }],
    });
    expect(arReport.document_type).toBe('ar_report');
    expect(arReport.matched_request_id).toBe('request-ar');
    expect(arReport.label).toBe('A/R aging report');
  });

  test('uses Azure OpenAI classification when filename rules are unclear', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key';
    process.env.AZURE_OPENAI_RESPONSES_URL = 'https://azure-openai.test/responses';
    process.env.AI_PROVIDER = 'azure';

    const originalFetch = global.fetch;
    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      expect(body.input?.[0]?.content?.[0]?.text).toContain('Tax docs required');
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          document_type: 'tax_return',
          confidence: 'high',
          reasoning: 'The uploaded file content is a business tax return and satisfies the open tax docs request.',
        }),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    try {
      const classification = await classifyDealDocumentUpload({
        fileName: 'merchant-file.pdf',
        mimeType: 'application/pdf',
        bytes: Buffer.from('%PDF-1.4 Form 1120 business return'),
        requests: [{ id: 'request-tax', document_type: 'tax_documents', label: 'Tax docs required', status: 'requested' }],
        funderRequirements: ['Business tax returns'],
      });

      expect(classification.provider).toBe('azure-openai');
      expect(classification.document_type).toBe('tax_return');
      expect(classification.confidence).toBe('high');
      expect(classification.matched_request_id).toBe('request-tax');
      expect(classification.label).toBe('Tax docs required');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
