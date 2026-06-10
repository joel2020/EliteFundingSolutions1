import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { generateLenderApplicationPdf, resolveLenderApplicationPdfFields } from '../lib/lender-application-pdf';
import { extractPartnerApplicationPayloadFromUpload } from '../lib/partner-application-extraction';
import { parsePartnerApplicationCsv } from '../lib/partner-application-fields';

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
    expect(fields.owner1.ownershipPercentage).toBe('100%');
    expect(fields.owner1.ssn).toBe('123-45-6789');
    expect(fields.owner1.dob).toBe('4/12/1985');
    expect(fields.signer).toBe('PDF Address Tester');
    expect(fields.requestedAmount).toBe('$125,000');
    expect(fields.averageMonthlySales).toBe('$85,000');
  });

  test('uses reviewed partner payload values before older CRM fields', () => {
    const fields = resolveLenderApplicationPdfFields({
      ...sampleApplicationData,
      business: {
        legal_name: 'Old CRM Name LLC',
        address: '1 Old Street, Miami, FL 33101',
        phone: '3055550000',
        email: 'old@example.com',
      },
      application: {
        ...sampleApplicationData.application,
        application_payload: {
          ...sampleApplicationData.application.application_payload,
          legal_name: 'Reviewed Partner Name LLC',
          address: '77 Reviewed Ave, Orlando, FL 32801',
          city: 'Orlando',
          state: 'FL',
          zip: '32801',
          business_phone: '4075550100',
          business_email: 'reviewed@example.com',
          ein: '987654321',
          owner1: {
            first_name: 'Reviewed',
            last_name: 'Owner',
            address: '44 Owner Way',
            city: 'Orlando',
            state: 'FL',
            zip: '32803',
            phone: '4075550111',
            email: 'owner-reviewed@example.com',
            ownership_percentage: '80',
          },
        },
      },
      owners: [
        {
          full_name: 'Old CRM Owner',
          address: '1 Old Owner Street',
          city: 'Miami',
          state: 'FL',
          zip: '33101',
          phone: '3055550001',
          email: 'old-owner@example.com',
        },
      ],
      ein: '123456789',
    });

    expect(fields.businessLegalName).toBe('Reviewed Partner Name LLC');
    expect(fields.businessStreet).toBe('77 Reviewed Ave');
    expect(fields.businessCityLine).toBe('Orlando, FL 32801');
    expect(fields.businessPhone).toBe('4075550100');
    expect(fields.businessEmail).toBe('reviewed@example.com');
    expect(fields.ein).toBe('98-7654321');
    expect(fields.owner1.name).toBe('Reviewed Owner');
    expect(fields.owner1.street).toBe('44 Owner Way');
    expect(fields.owner1.cityLine).toBe('Orlando, FL 32803');
    expect(fields.owner1.ownershipPercentage).toBe('80%');
  });

  test('prints full EIN only from decrypted or reviewed full Tax ID sources', () => {
    const decryptedFields = resolveLenderApplicationPdfFields({
      application: { application_payload: {} },
      business: { legal_name: 'Secure Merchant LLC', ein_last4: '4321' },
      ein: '123456789',
    });
    expect(decryptedFields.ein).toBe('12-3456789');

    const reviewedFields = resolveLenderApplicationPdfFields({
      application: { application_payload: { legal_name: 'Reviewed Merchant LLC', ein: '987654321' } },
      business: { ein_last4: '1111' },
    });
    expect(reviewedFields.ein).toBe('98-7654321');

    const last4OnlyFields = resolveLenderApplicationPdfFields({
      application: { application_payload: {} },
      business: { legal_name: 'Partial Merchant LLC', ein_last4: '4321' },
      ein: null,
    });
    expect(last4OnlyFields.ein).toBe('');
  });

  test('uses reviewed partner signature fields when converting to Elite PDF', () => {
    const fields = resolveLenderApplicationPdfFields({
      ...sampleApplicationData,
      application: {
        application_payload: {
          legal_name: 'Partner Signed Merchant LLC',
          signature: 'Partner Signed Owner',
          signature_date: '2026-06-01',
          owner1: {
            first_name: 'Partner',
            last_name: 'Owner',
          },
        },
      },
    });

    expect(fields.signer).toBe('Partner Signed Owner');
    expect(fields.signatureDate).toBe('6/1/2026');
  });

  test('uses the stored electronic signature name when signed_name is unavailable', () => {
    const fields = resolveLenderApplicationPdfFields({
      ...sampleApplicationData,
      application: {
        ...sampleApplicationData.application,
        signed_name: '',
        e_signature: 'Stored E-Sign Owner',
        application_payload: {
          signature: '',
        },
      },
    });

    expect(fields.signer).toBe('Stored E-Sign Owner');
  });

  test('prints the full SSN from decrypted owner or application payload sources only', () => {
    const decryptedFields = resolveLenderApplicationPdfFields({
      application: { application_payload: {} },
      owners: [{ first_name: 'Secure', last_name: 'Owner', ssn_last4: '6789', ssn_decrypted: '123456789' }],
    });
    expect(decryptedFields.owner1.ssn).toBe('123-45-6789');

    const topLevelPayloadFields = resolveLenderApplicationPdfFields({
      application: {
        application_payload: {
          full_name: 'Payload Owner',
          ssn: '987654321',
          dob: '1980-01-02',
          ownership_pct: '100',
        },
      },
      owners: [],
    });
    expect(topLevelPayloadFields.owner1.ssn).toBe('987-65-4321');
    expect(topLevelPayloadFields.owner1.dob).toBe('1/2/1980');
    expect(topLevelPayloadFields.owner1.ownershipPercentage).toBe('100%');

    const last4OnlyFields = resolveLenderApplicationPdfFields({
      application: { application_payload: {} },
      owners: [{ first_name: 'Partial', last_name: 'Owner', ssn_last4: '6789' }],
    });
    expect(last4OnlyFields.owner1.ssn).toBe('');
  });

  test('uses top-level public application owner aliases when owner rows are unavailable', () => {
    const fields = resolveLenderApplicationPdfFields({
      application: {
        application_payload: {
          legal_name: 'Alias Owner Merchant LLC',
          full_name: 'Public Alias Owner',
          home_address: '55 Public Owner Rd, Miami, FL 33130',
          phone: '3055550199',
          email: 'public-owner@example.test',
          percent_of_ownership: '100',
          date_of_birth: '1984-02-03',
          social_security_number: '321654987',
          driver_license_number: 'FL-Alias-12345',
          signature: 'Public Alias Owner',
          signature_date: '2026-06-10',
        },
      },
      owners: [],
    });

    expect(fields.owner1.name).toBe('Public Alias Owner');
    expect(fields.owner1.street).toBe('55 Public Owner Rd');
    expect(fields.owner1.cityLine).toBe('Miami, FL 33130');
    expect(fields.owner1.phone).toBe('3055550199');
    expect(fields.owner1.email).toBe('public-owner@example.test');
    expect(fields.owner1.ownershipPercentage).toBe('100%');
    expect(fields.owner1.dob).toBe('2/3/1984');
    expect(fields.owner1.ssn).toBe('321-65-4987');
    expect(fields.owner1.driversLicense).toBe('FL-Alias-12345');
  });

  test('does not leak business contact data into a blank second-owner column', () => {
    const fields = resolveLenderApplicationPdfFields({
      ...sampleApplicationData,
      owners: [{
        first_name: 'Primary',
        last_name: 'Owner',
        email: 'primary-owner@example.test',
      }],
      application: {
        application_payload: {
          business_email: 'business@example.test',
          cell_phone: '8135550100',
        },
      },
    });

    expect(fields.owner1.email).toBe('primary-owner@example.test');
    expect(fields.owner2.name).toBe('');
    expect(fields.owner2.email).toBe('');
    expect(fields.owner2.phone).toBe('');
  });

  test('resolves optional co-owner fields into the second owner PDF column', () => {
    const fields = resolveLenderApplicationPdfFields({
      ...sampleApplicationData,
      application: {
        application_payload: {
          owner2: {
            first_name: 'Jordan',
            last_name: 'Reed',
            address: '40 Partner Ave, Brooklyn, NY 11201',
            phone: '7185550166',
            email: 'jordan@fastsubmit.test',
            ownership_pct: '40',
            dob: '1987-07-12',
            ssn: '987654321',
          },
        },
      },
      owners: [
        sampleApplicationData.owners[0],
        {
          first_name: 'Old',
          last_name: 'CoOwner',
          address: 'Old Address',
          ownership_percentage: '20',
        },
      ],
    });

    expect(fields.owner2.name).toBe('Jordan Reed');
    expect(fields.owner2.street).toBe('40 Partner Ave');
    expect(fields.owner2.cityLine).toBe('Brooklyn, NY 11201');
    expect(fields.owner2.ownershipPercentage).toBe('40%');
    expect(fields.owner2.dob).toBe('7/12/1987');
    expect(fields.owner2.ssn).toBe('987-65-4321');
  });

  test('summarizes up to three open advances without dropping balances', () => {
    const fields = resolveLenderApplicationPdfFields({
      ...sampleApplicationData,
      application: {
        application_payload: {
          has_existing_advances: true,
          existing_advances: [
            { funder_name: 'First Funder', current_balance: '$12,500', daily_payment: '$250' },
            { funder_name: 'Second Capital', current_balance: '$8,000' },
            { funder_name: 'Third Advance', current_balance: '$4,500' },
          ],
        },
      },
    });

    expect(fields.hasExistingAdvance).toBe(true);
    expect(fields.existingAdvanceFunder).toContain('1) First Funder $12,500');
    expect(fields.existingAdvanceFunder).toContain('2) Second Capital $8,000');
    expect(fields.existingAdvanceFunder).toContain('3) Third Advance $4,500');
    expect(fields.existingAdvanceBalance).toBe('$25,000');
  });

  test('maps partner CSV signature fields for PDF review', () => {
    const payload = parsePartnerApplicationCsv(
      'business_name,owner_name,signature,signature_date,requested_amount\nPartner Merchant LLC,Pat Owner,Pat Owner,2026-06-01,50000',
    );

    expect(payload.legal_name).toBe('Partner Merchant LLC');
    expect(payload.signature).toBe('Pat Owner');
    expect(payload.signature_date).toBe('2026-06-01');
  });

  test('maps partner CSV address, DOB, SSN, and ownership aliases', () => {
    const payload = parsePartnerApplicationCsv(
      'legal_business_name,company_address,owner_name,home_address,percent_of_ownership,owner_date_of_birth,owner_ssn,tax_id\nAlias Merchant LLC,\"700 Main St, Dallas, TX 75201\",Dana Owner,\"99 Owner Rd, Austin, TX 78701\",75,02/03/1980,111223333,987654321',
    );

    expect(payload.legal_name).toBe('Alias Merchant LLC');
    expect(payload.address).toBe('700 Main St');
    expect(payload.city).toBe('Dallas');
    expect(payload.state).toBe('TX');
    expect(payload.zip).toBe('75201');
    expect(payload.ein).toBe('987654321');
    expect(payload.owner1.address).toBe('99 Owner Rd');
    expect(payload.owner1.city).toBe('Austin');
    expect(payload.owner1.state).toBe('TX');
    expect(payload.owner1.zip).toBe('78701');
    expect(payload.owner1.ownership_percentage).toBe('75');
    expect(payload.owner1.dob).toBe('02/03/1980');
    expect(payload.owner1.ssn).toBe('111223333');
  });

  test('splits non-comma business and owner addresses into city state zip', () => {
    const payload = parsePartnerApplicationCsv(
      'legal_business_name,company_address,owner_name,home_address,percent_of_ownership,owner_date_of_birth,owner_ssn,tax_id\nInline Address Merchant LLC,700 Main St Dallas TX 75201,Dana Owner,99 Owner Rd Austin TX 78701,75,02/03/1980,111223333,987654321',
    );

    expect(payload.address).toBe('700 Main St');
    expect(payload.city).toBe('Dallas');
    expect(payload.state).toBe('TX');
    expect(payload.zip).toBe('75201');
    expect(payload.owner1.address).toBe('99 Owner Rd');
    expect(payload.owner1.city).toBe('Austin');
    expect(payload.owner1.state).toBe('TX');
    expect(payload.owner1.zip).toBe('78701');

    const fields = resolveLenderApplicationPdfFields({
      application: { application_payload: payload },
      owners: [],
    });
    expect(fields.businessStreet).toBe('700 Main St');
    expect(fields.businessCityLine).toBe('Dallas, TX 75201');
    expect(fields.owner1.street).toBe('99 Owner Rd');
    expect(fields.owner1.cityLine).toBe('Austin, TX 78701');
  });

  test('maps partner CSV co-owner and open advance aliases', () => {
    const payload = parsePartnerApplicationCsv(
      'legal_business_name,owner_name,owner2_first_name,owner2_last_name,owner2_address,owner2_percent_ownership,owner2_date_of_birth,owner2_ssn,open_advance_funder,open_advance_balance,open_advance_2_funder,open_advance_2_balance\nAlias Merchant LLC,Dana Owner,Riley,Partner,\"10 Coowner Rd, Austin, TX 78702\",25,04/05/1982,999887777,Fast Fund,$12000,Second Fund,$7000',
    );

    expect(payload.owner2.first_name).toBe('Riley');
    expect(payload.owner2.last_name).toBe('Partner');
    expect(payload.owner2.address).toBe('10 Coowner Rd');
    expect(payload.owner2.city).toBe('Austin');
    expect(payload.owner2.state).toBe('TX');
    expect(payload.owner2.zip).toBe('78702');
    expect(payload.owner2.ownership_percentage).toBe('25');
    expect(payload.owner2.dob).toBe('04/05/1982');
    expect(payload.owner2.ssn).toBe('999887777');
    expect(payload.existing_advances).toHaveLength(2);
    expect(payload.existing_advances[0].funder_name).toBe('Fast Fund');
    expect(payload.existing_advances[1].current_balance).toBe('$7000');
  });

  test('extracts partner PDF form fields before converting to Elite PDF', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    const form = pdf.getForm();
    form.createTextField('business_name').setText('Form Partner LLC');
    form.createTextField('owner_name').setText('Jordan Partner');
    form.createTextField('signature').setText('Jordan Partner');
    form.createTextField('signature_date').setText('2026-06-02');
    form.createTextField('requested_amount').setText('$88,000');
    const bytes = Buffer.from(await pdf.save());

    const payload = await extractPartnerApplicationPayloadFromUpload({
      fileName: 'partner-application.pdf',
      mimeType: 'application/pdf',
      bytes,
      fallback: { company_name: 'Fallback LLC' },
    });

    expect(payload.legal_name).toBe('Form Partner LLC');
    expect(payload.signature).toBe('Jordan Partner');
    expect(payload.signature_date).toBe('2026-06-02');
    expect(payload.requested_amount).toBe('$88,000');
    expect(payload.owner1.first_name).toBe('Jordan');
    expect(payload.owner1.last_name).toBe('Partner');
  });

  test('uses AI extraction for partner PDFs when form fields are missing', async () => {
    const originalFetch = global.fetch;
    process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
    process.env.AZURE_OPENAI_RESPONSES_URL = 'https://azure.test/openai/responses';
    process.env.AI_PROVIDER = 'azure';
    const calls: any[] = [];
    global.fetch = (async (url: any, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          company_name: 'AI Extracted Merchant LLC',
          legal_name: 'AI Extracted Merchant LLC',
          dba: 'AI Merchant',
          business_address: '500 AI Blvd, Phoenix, AZ 85001',
          address: '500 AI Blvd, Phoenix, AZ 85001',
          city: 'Phoenix',
          state: 'AZ',
          zip: '85001',
          business_phone: '6025550100',
          business_email: 'merchant@ai.test',
          ein: '991112222',
          start_date: '2021-02-03',
          requested_amount: '$125,000',
          products_services: 'Retail',
          industry: 'Retail',
          signature: 'Alex AI Owner',
          signature_date: '2026-06-08',
          owner1: {
            first_name: 'Alex',
            last_name: 'Owner',
            address: '88 Owner Street, Phoenix, AZ 85002',
            city: 'Phoenix',
            state: 'AZ',
            zip: '85002',
            phone: '6025550199',
            mobile: '6025550199',
            email: 'owner@ai.test',
            ownership_percentage: '65',
            dob: '1981-07-04',
            ssn: '222334444',
          },
          owner2: {
            first_name: 'Riley',
            last_name: 'Coowner',
            address: '12 Second Owner Ave, Phoenix, AZ 85003',
            city: 'Phoenix',
            state: 'AZ',
            zip: '85003',
            phone: '6025550188',
            mobile: '6025550188',
            email: 'coowner@ai.test',
            ownership_percentage: '35',
            dob: '1982-08-09',
            ssn: '555667777',
          },
          existing_advances: [
            {
              funder_name: 'AI Advance Co',
              original_amount: '',
              current_balance: '$15,000',
              daily_payment: '$300',
              payment_frequency: 'daily',
              notes: '',
            },
          ],
          confidence: 'high',
          missing_fields: [],
          extraction_notes: 'All required fields found.',
        }),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    try {
      const pdf = await PDFDocument.create();
      pdf.addPage([612, 792]);
      const bytes = Buffer.from(await pdf.save());
      const payload = await extractPartnerApplicationPayloadFromUpload({
        fileName: 'scanned-partner-application.pdf',
        mimeType: 'application/pdf',
        bytes,
        fallback: { legal_name: 'Fallback Merchant LLC' },
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].body.input[0].content.some((part: any) => part.type === 'input_file')).toBe(true);
      expect(payload.legal_name).toBe('AI Extracted Merchant LLC');
      expect(payload.city).toBe('Phoenix');
      expect(payload.state).toBe('AZ');
      expect(payload.zip).toBe('85001');
      expect(payload.ein).toBe('991112222');
      expect(payload.owner1.address).toBe('88 Owner Street');
      expect(payload.owner1.city).toBe('Phoenix');
      expect(payload.owner1.state).toBe('AZ');
      expect(payload.owner1.zip).toBe('85002');
      expect(payload.owner1.ownership_percentage).toBe('65');
      expect(payload.owner1.dob).toBe('1981-07-04');
      expect(payload.owner1.ssn).toBe('222334444');
      expect(payload.owner2.first_name).toBe('Riley');
      expect(payload.owner2.ownership_percentage).toBe('35');
      expect(payload.owner2.ssn).toBe('555667777');
      expect(payload.existing_advances[0].funder_name).toBe('AI Advance Co');
      expect(payload.existing_advances[0].current_balance).toBe('$15,000');
      expect((payload as any).extraction_provider).toBe('azure-openai');
    } finally {
      global.fetch = originalFetch;
      delete process.env.AZURE_OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_RESPONSES_URL;
      delete process.env.AI_PROVIDER;
    }
  });

  test('uses inline drawn signature PNG data from partner payloads', () => {
    const signatureDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const fields = resolveLenderApplicationPdfFields({
      ...sampleApplicationData,
      application: {
        application_payload: {
          signature_data_url: signatureDataUrl,
        },
      },
    });

    expect(fields.drawnSignaturePng?.length).toBeGreaterThan(0);
  });

  test('accepts stored signature PNG bytes for regenerated PDFs', () => {
    const signaturePng = Buffer.from('signature-bytes');
    const fields = resolveLenderApplicationPdfFields({
      ...sampleApplicationData,
      drawnSignaturePng: signaturePng,
    });

    expect(fields.drawnSignaturePng).toBe(signaturePng);
  });

  test('generates a completed application when a valid drawn signature PNG is present', async () => {
    const validSignaturePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64',
    );
    const pdfBuffer = await generateLenderApplicationPdf({
      ...sampleApplicationData,
      drawnSignaturePng: validSignaturePng,
    });
    const pdf = await PDFDocument.load(pdfBuffer);

    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(pdfBuffer.length).toBeGreaterThan(100_000);
  });

  test('generates a branded multi-page PDF from the resolved data contract', async () => {
    const pdfBuffer = await generateLenderApplicationPdf(sampleApplicationData);
    const pdf = await PDFDocument.load(pdfBuffer);

    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(pdfBuffer.length).toBeGreaterThan(100_000);
  });
});
