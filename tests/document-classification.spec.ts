import { expect, test } from '@playwright/test';
import { classifyDealDocumentUpload, sameCrmDocumentType } from '../lib/document-classification';

test.describe('CRM document classification aliases', () => {
  test('matches common funder requirement wording to CRM document types', () => {
    expect(sameCrmDocumentType('drivers_license', 'owner ID')).toBe(true);
    expect(sameCrmDocumentType('license_verification', 'photo id')).toBe(true);
    expect(sameCrmDocumentType('tax_return', 'tax documents')).toBe(true);
    expect(sameCrmDocumentType('bank_statements', 'month-to-date bank statement')).toBe(true);
    expect(sameCrmDocumentType('voided_check', 'bank letter')).toBe(true);
    expect(sameCrmDocumentType('payoff_letter', 'payoff statement')).toBe(true);
    expect(sameCrmDocumentType('advance_statements', 'MCA balance letter')).toBe(true);
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
  });
});
