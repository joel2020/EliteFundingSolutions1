import { expect, test } from '@playwright/test';
import { mockCrmApis } from './helpers/crm-fixtures';

test.describe('public funding application', () => {
  test('submits the simplified funding-options application', async ({ page }) => {
    await mockCrmApis(page);
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
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByTestId('application-company-name').fill('Fast Submit LLC');
    await page.getByTestId('application-business-address').fill('10 Main Street, New York, NY 10001');
    await page.getByTestId('application-tax-id-ein').fill('123456789');
    await page.getByTestId('application-business-start-date').fill('2021-01-15');
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByText('***-6789')).toHaveCount(2);
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
