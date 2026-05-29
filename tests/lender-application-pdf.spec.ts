import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { generateLenderApplicationPdf, resolveLenderApplicationPdfFields } from '../lib/lender-application-pdf';

const sampleApplicationData = {
  deal: {
    title: 'PDF Address QA LLC',
    requested_amount: 125000,
  },
  business: {
    legal_name: 'PDF Address QA LLC',
    address: '2202 N Westshore Blvd, Tampa, FL 33607',
    phone: '8135550101',
    email: 'ops@pdf-address-qa.test',
    industry: 'Retail',
  },
  application: {
    requested_amount: 125000,
    signed_name: 'PDF Address Tester',
    submitted_at: '2026-05-29T16:30:00.000Z',
    application_payload: {
      company_name: 'PDF Address QA LLC',
      business_address: '2202 N Westshore Blvd, Tampa, FL 33607',
      ein: '123456789',
      business_start_date: '2020-03-15',
      full_name: 'PDF Address Tester',
      home_address: '123 Owner Lane, Tampa, FL 33602',
      cell_phone: '8135550199',
      business_email: 'owner@pdf-address-qa.test',
      ssn: '123456789',
      dob: '1985-04-12',
      signature: 'PDF Address Tester',
      requested_amount: 125000,
      average_monthly_sales: 85000,
      entity_type: 'llc',
      merchant_type: 'retail',
      business_location: 'storefront',
    },
  },
  owners: [
    {
      full_name: 'PDF Address Tester',
      home_address: '123 Owner Lane, Tampa, FL 33602',
      phone: '8135550199',
      email: 'owner@pdf-address-qa.test',
      ownership_percentage: 100,
      ssn: '123456789',
      dob: '1985-04-12',
    },
  ],
};

test.describe('lender application PDF data mapping', () => {
  test('resolves public application fields into lender-ready PDF values', () => {
    const fields = resolveLenderApplicationPdfFields(sampleApplicationData);

    expect(fields.businessLegalName).toBe('PDF Address QA LLC');
    expect(fields.businessStreet).toBe('2202 N Westshore Blvd');
    expect(fields.businessCityLine).toBe('Tampa, FL 33607');
    expect(fields.businessState).toBe('FL');
    expect(fields.businessZip).toBe('33607');
    expect(fields.ein).toBe('12-3456789');
    expect(fields.businessStartDate).toBe('3/15/2020');
    expect(fields.owner1.name).toBe('PDF Address Tester');
    expect(fields.owner1.street).toBe('123 Owner Lane');
    expect(fields.owner1.cityLine).toBe('Tampa, FL 33602');
    expect(fields.owner1.ssn).toBe('123-45-6789');
    expect(fields.owner1.dob).toBe('4/12/1985');
    expect(fields.signer).toBe('PDF Address Tester');
    expect(fields.requestedAmount).toBe('$125,000');
    expect(fields.averageMonthlySales).toBe('$85,000');
  });

  test('generates a branded multi-page PDF from the resolved data contract', async () => {
    const pdfBuffer = await generateLenderApplicationPdf(sampleApplicationData);
    const pdf = await PDFDocument.load(pdfBuffer);

    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(pdfBuffer.length).toBeGreaterThan(100_000);
  });
});
