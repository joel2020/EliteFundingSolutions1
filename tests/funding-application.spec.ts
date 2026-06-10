import { expect, test } from '@playwright/test';
import { normalizeIncomingPayload } from '../app/api/applications/submit/route';
import { mockCrmApis } from './helpers/crm-fixtures';

test.describe('public funding application', () => {
  test('submits the simplified funding-options application', async ({ page }) => {
    const { calls } = await mockCrmApis(page);
    await page.route('**/api/applications/*/signature', async (route) => {
      const payload = route.request().postDataJSON() as any;
      expect(payload.signature_data_url).toContain('data:image/png;base64,');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, documentId: 'signed-doc-1' }) });
    });

    await page.goto('/apply');

    await page.getByTestId('application-full-name').fill('Taylor Reed');
    await page.getByTestId('application-home-address').fill('20 Broadway, New York, NY 10002');
    await page.getByTestId('application-social-security-number').fill('123456789');
    await page.getByTestId('application-date-of-birth').fill('1985-04-10');
    await page.getByTestId('application-cell-phone-number').fill('2125550144');
    await page.getByTestId('application-email-address').fill('taylor@fastsubmit.test');
    await page.getByTestId('application-ownership-percentage').fill('60');
    await page.getByTestId('application-co-owner-full-name').fill('Jordan Reed');
    await page.getByTestId('application-co-owner-home-address').fill('40 Partner Ave, Brooklyn, NY 11201');
    await page.getByTestId('application-co-owner-social-security-number').fill('987654321');
    await page.getByTestId('application-co-owner-date-of-birth').fill('1987-07-12');
    await page.getByTestId('application-co-owner-cell-phone-number').fill('7185550166');
    await page.getByTestId('application-co-owner-email-address').fill('jordan@fastsubmit.test');
    await page.getByTestId('application-co-owner-ownership-percentage').fill('40');
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByTestId('application-company-name').fill('Fast Submit LLC');
    await page.getByTestId('application-business-address').fill('10 Main Street, New York, NY 10001');
    await page.getByTestId('application-tax-id-ein').fill('123456789');
    await page.getByTestId('application-business-start-date').fill('2021-01-15');
    await page.getByTestId('application-requested-funding-amount').fill('75000');
    await page.getByTestId('application-industry').fill('Retail');
    await page.getByTestId('application-use-of-funds').fill('Inventory and payroll');
    await page.getByTestId('application-open-advance-funder').fill('Old Advance Co');
    await page.getByTestId('application-open-advance-balance').fill('12500');
    await page.getByTestId('application-open-advance-2-funder').fill('Second Capital');
    await page.getByTestId('application-open-advance-2-balance').fill('8000');
    await page.getByTestId('application-open-advance-3-funder').fill('Third Advance');
    await page.getByTestId('application-open-advance-3-balance').fill('4500');
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByText('***-6789')).toHaveCount(2);
    await expect(page.getByText('60%')).toBeVisible();
    await expect(page.getByText('Jordan Reed')).toBeVisible();
    await expect(page.getByText('40%')).toBeVisible();
    await expect(page.getByText('$75,000')).toBeVisible();
    await expect(page.getByText('Inventory and payroll')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Authorization', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Credit Review Consent' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Electronic Signature Consent' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Communication Consent' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Privacy Notice' })).toBeVisible();
    const disclosureText = page.getByText('I authorize Elite Funding Solutions and its funding partners to review my business').first();
    await expect(disclosureText).toHaveCSS('color', 'rgb(17, 24, 39)');
    await expect(disclosureText).toHaveCSS('font-size', '14px');
    const signaturePad = page.getByTestId('application-signature-pad');
    await signaturePad.dragTo(signaturePad, {
      sourcePosition: { x: 40, y: 95 },
      targetPosition: { x: 260, y: 105 },
    });
    await expect(page.getByText('Signature captured.')).toBeVisible();
    await page.getByLabel(/I have read and agree to the Authorization/).check();
    await page.getByRole('button', { name: /Get My Funding Options/i }).click();

    await expect(page.getByText('Application Received')).toBeVisible();
    await expect(page.getByText('Thank you. Your signed application has been received. An Elite Funding Solutions funding specialist will review your information and contact you shortly.')).toBeVisible();
    const submissionCall = calls.find((call) => call.table === 'applications_submit_api');
    expect(submissionCall?.body).toEqual(expect.objectContaining({
      email: 'taylor@fastsubmit.test',
      ownership_percentage: '60',
      co_owner_full_name: 'Jordan Reed',
      co_owner_home_address: '40 Partner Ave, Brooklyn, NY 11201',
      co_owner_ssn: '987-65-4321',
      co_owner_dob: '1987-07-12',
      co_owner_cell_phone: '(718) 555-0166',
      co_owner_email: 'jordan@fastsubmit.test',
      co_owner_ownership_percentage: '40',
      requested_amount: '$75,000',
      industry: 'Retail',
      use_of_funds: 'Inventory and payroll',
      existing_advance_funder: 'Old Advance Co',
      existing_advance_balance: '$12,500',
      existing_advance_2_funder: 'Second Capital',
      existing_advance_2_balance: '$8,000',
      existing_advance_3_funder: 'Third Advance',
      existing_advance_3_balance: '$4,500',
    }));
  });

  test('maps optional co-owner intake into the full application payload contract', () => {
    const normalized = normalizeIncomingPayload({
      full_name: 'Taylor Reed',
      home_address: '20 Broadway, New York, NY 10002',
      ssn: '123-45-6789',
      dob: '1985-04-10',
      cell_phone: '(212) 555-0144',
      email: 'taylor@fastsubmit.test',
      ownership_percentage: '60',
      co_owner_full_name: 'Jordan Reed',
      co_owner_home_address: '40 Partner Ave, Brooklyn, NY 11201',
      co_owner_ssn: '987-65-4321',
      co_owner_dob: '1987-07-12',
      co_owner_cell_phone: '(718) 555-0166',
      co_owner_email: 'jordan@fastsubmit.test',
      co_owner_ownership_percentage: '40',
      company_name: 'Fast Submit LLC',
      business_address: '10 Main Street, New York, NY 10001',
      ein: '12-3456789',
      business_start_date: '2021-01-15',
      requested_amount: '$75,000',
      industry: 'Retail',
      use_of_funds: 'Inventory and payroll',
      existing_advance_funder: 'Old Advance Co',
      existing_advance_balance: '$12,500',
      existing_advance_2_funder: 'Second Capital',
      existing_advance_2_balance: '$8,000',
      existing_advance_3_funder: 'Third Advance',
      existing_advance_3_balance: '$4,500',
      consent_accepted: true,
    });

    expect(normalized.owner1).toEqual(expect.objectContaining({
      first_name: 'Taylor',
      last_name: 'Reed',
      ownership_pct: '60',
      email: 'taylor@fastsubmit.test',
      ssn: '123-45-6789',
      address: '20 Broadway',
      city: 'New York',
      state: 'NY',
      zip: '10002',
    }));
    expect(normalized.owner2).toEqual(expect.objectContaining({
      first_name: 'Jordan',
      last_name: 'Reed',
      address: '40 Partner Ave',
      city: 'Brooklyn',
      state: 'NY',
      zip: '11201',
      ownership_pct: '40',
      email: 'jordan@fastsubmit.test',
      phone: '(718) 555-0166',
      dob: '1987-07-12',
      ssn: '987-65-4321',
    }));
    expect(normalized).toEqual(expect.objectContaining({
      address: '10 Main Street',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      has_existing_advances: true,
    }));
    expect(normalized.existing_advances).toEqual([
      expect.objectContaining({ funder_name: 'Old Advance Co', current_balance: '$12,500' }),
      expect.objectContaining({ funder_name: 'Second Capital', current_balance: '$8,000' }),
      expect.objectContaining({ funder_name: 'Third Advance', current_balance: '$4,500' }),
    ]);
    expect(normalized.notes).toContain('Open advance 3: Third Advance - $4,500');
  });

  test('requires the minimum identity and business fields', async ({ page }) => {
    await mockCrmApis(page);

    await page.goto('/apply');
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByText('Please enter your full name.')).toBeVisible();
  });

  test('keeps disclosure text readable on mobile', async ({ page }) => {
    await mockCrmApis(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/apply');
    await page.getByTestId('application-full-name').fill('Taylor Reed');
    await page.getByTestId('application-home-address').fill('20 Broadway, New York, NY 10002');
    await page.getByTestId('application-social-security-number').fill('123456789');
    await page.getByTestId('application-date-of-birth').fill('1985-04-10');
    await page.getByTestId('application-cell-phone-number').fill('2125550144');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByTestId('application-company-name').fill('Fast Submit LLC');
    await page.getByTestId('application-business-address').fill('10 Main Street, New York, NY 10001');
    await page.getByTestId('application-tax-id-ein').fill('123456789');
    await page.getByTestId('application-business-start-date').fill('2021-01-15');
    await page.getByRole('button', { name: /continue/i }).click();

    const mobileDisclosure = page.getByText('Please read these disclosures before submitting.').first();
    await expect(mobileDisclosure).toBeVisible();
    await expect(mobileDisclosure).toHaveCSS('font-size', '15px');
    await expect(mobileDisclosure).toHaveCSS('color', 'rgb(17, 24, 39)');
  });
});
