import { expect, test } from '@playwright/test';
import { mockCrmApis } from './helpers/crm-fixtures';

test.describe('public funding application', () => {
  test('submits a simplified funding application without required document upload', async ({ page }) => {
    await mockCrmApis(page);

    await page.goto('/apply');

    await page.getByTestId('application-business-legal-name').fill('Cedar Market LLC');
    await page.getByTestId('application-dba-name').fill('Cedar Market');
    await page.getByTestId('application-legal-entity-type').selectOption('llc');
    await page.getByTestId('application-full-federal-tax-id-ein').fill('12-3456789');
    await page.getByTestId('application-date-business-started').fill('2021-01-15');
    await page.getByTestId('application-business-location').selectOption('leased');
    await page.getByTestId('application-business-phone').fill('2125550199');
    await page.getByTestId('application-business-mobile-phone').fill('2125550188');
    await page.getByTestId('application-business-email').fill('owner@cedarmarket.test');
    await page.getByTestId('application-address').fill('10 Main Street');
    await page.getByTestId('application-city').fill('New York');
    await page.getByTestId('application-state').selectOption('NY');
    await page.getByTestId('application-zip').fill('10001');
    await page.getByTestId('application-products-services-sold').fill('Specialty grocery');
    await page.getByTestId('application-industry').fill('Retail');
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByTestId('application-first-name').first().fill('Casey');
    await page.getByTestId('application-last-name').first().fill('Morgan');
    await page.getByTestId('application-title').first().fill('Owner');
    await page.getByTestId('application-ownership').first().fill('100');
    await page.getByTestId('application-email').first().fill('casey@cedarmarket.test');
    await page.getByTestId('application-owner-phone').first().fill('2125550133');
    await page.getByTestId('application-owner-mobile-phone').first().fill('2125550144');
    await page.getByTestId('application-date-of-birth').first().fill('1985-04-10');
    await page.getByTestId('application-full-social-security-number').first().fill('123-45-6789');
    await page.getByTestId('application-credit-score-range').first().selectOption('680-719');
    await page.getByTestId('application-home-address').first().fill('20 Broadway');
    await page.getByTestId('application-city').first().fill('New York');
    await page.getByTestId('application-state').first().selectOption('NY');
    await page.getByTestId('application-zip').first().fill('10002');
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByTestId('application-amount-requested').fill('50000');
    await page.getByTestId('application-use-of-funds').fill('Inventory');
    await page.getByTestId('application-average-monthly-sales').fill('85000');
    await page.getByTestId('application-average-visa-mastercard-monthly-sales').fill('30000');
    await page.getByTestId('application-monthly-gross-revenue').fill('90000');
    await page.getByTestId('application-desired-funding-timeline').selectOption('asap');
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByLabel(/I certify that all information/).check();
    await page.getByLabel(/I authorize Elite Funding Solutions/).check();
    await page.getByLabel(/I consent to use electronic records/).check();
    await page.getByLabel(/I consent to receive text messages/).check();
    await page.getByLabel(/I agree to the Privacy Policy/).check();
    await page.getByTestId('application-signed-name').fill('Casey Morgan');
    await page.getByRole('button', { name: /submit application/i }).click();

    await expect(page.getByText('Application Submitted')).toBeVisible();
  });

  test('submits minimum required fields on mobile with readable funding labels', async ({ page }) => {
    await mockCrmApis(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/apply');

    await page.getByTestId('application-business-legal-name').fill('Minimum Fields LLC');
    await page.getByTestId('application-full-federal-tax-id-ein').fill('98-7654321');
    await page.getByTestId('application-date-business-started').fill('2022-02-02');
    await page.getByTestId('application-address').fill('100 Main Street');
    await page.getByTestId('application-city').fill('New York');
    await page.getByTestId('application-state').selectOption('NY');
    await page.getByTestId('application-zip').fill('10001');
    await page.getByTestId('application-industry').fill('Construction');
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByTestId('application-first-name').first().fill('Morgan');
    await page.getByTestId('application-last-name').first().fill('Lee');
    await page.getByTestId('application-owner-mobile-phone').first().fill('5165550199');
    await page.getByTestId('application-date-of-birth').first().fill('1987-08-08');
    await page.getByTestId('application-full-social-security-number').first().fill('222-33-4444');
    await page.getByTestId('application-home-address').first().fill('200 Oak Ave');
    await page.getByTestId('application-city').first().fill('New York');
    await page.getByTestId('application-state').first().selectOption('NY');
    await page.getByTestId('application-zip').first().fill('10002');
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByText('Funding Information')).toBeVisible();
    for (const label of ['Amount Requested', 'Use of Funds', 'Average Monthly Sales', 'Monthly Gross Revenue']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: /continue/i }).click();

    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByText(/Application certification/i)).toBeVisible();
    await expect(page.getByText(/Bank statements optional/i)).toBeVisible();
    await expect(page.getByText(/No bank statements selected/i)).toBeVisible();
    await page.getByLabel(/I certify that all information/).check();
    await page.getByLabel(/I authorize Elite Funding Solutions/).check();
    await page.getByLabel(/I consent to use electronic records/).check();
    await page.getByLabel(/I consent to receive text messages/).check();
    await page.getByLabel(/I agree to the Privacy Policy/).check();
    await page.getByTestId('application-signed-name').fill('Morgan Lee');
    await page.getByRole('button', { name: /submit application/i }).click();

    await expect(page.getByText('Application Submitted')).toBeVisible();
    await expect(page.getByText(/bank statements have been received/i)).toHaveCount(0);
  });
});
