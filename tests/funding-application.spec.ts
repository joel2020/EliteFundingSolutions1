import { expect, test } from '@playwright/test';
import { mockCrmApis } from './helpers/crm-fixtures';

test.describe('public funding application', () => {
  test('submits the simplified funding-options application', async ({ page }) => {
    await mockCrmApis(page);

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
    await page.getByLabel(/I certify that this information is accurate/).check();
    await page.getByRole('button', { name: /Get My Funding Options/i }).click();

    await expect(page.getByText('Application Received')).toBeVisible();
    await expect(page.getByText('Thank you. Your application has been received. An Elite Funding Solutions funding specialist will review your information and contact you shortly.')).toBeVisible();
  });

  test('requires the minimum identity and business fields', async ({ page }) => {
    await mockCrmApis(page);

    await page.goto('/apply');
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByText('Please enter your full name.')).toBeVisible();
  });
});
