import { expect, test } from '@playwright/test';
import { DEAL_ID, DOC_ID, LEAD_ID, mockCrmApis } from './helpers/crm-fixtures';

test.describe('Elite Funding Solutions CRM workflows', () => {
  test('login and logout', async ({ page }) => {
    await mockCrmApis(page);

    await page.goto('/login');
    await page.getByTestId('login-email').fill('admin@elitefunding.test');
    await page.getByTestId('login-password').fill('password-123');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/crm$/);
    await expect(page.getByTestId('crm-page-executive-dashboard')).toBeVisible();

    await page.getByTestId('crm-sign-out').click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('creates a lead and converts it to a deal', async ({ page }) => {
    const { state, calls } = await mockCrmApis(page);

    await page.goto('/crm/leads');
    await expect(page.getByTestId('crm-page-leads')).toBeVisible();

    await page.getByTestId('add-lead').click();
    await page.getByTestId('lead-business_name').fill('Northstar Cafe');
    await page.getByTestId('lead-first_name').fill('Nora');
    await page.getByTestId('lead-last_name').fill('Fields');
    await page.getByTestId('lead-phone').fill('2125550120');
    await page.getByTestId('lead-email').fill('nora@northstar.test');
    await page.getByTestId('lead-requested_amount').fill('45000');
    await page.getByTestId('lead-notes').fill('Looking for working capital.');
    await page.getByTestId('save-lead').click();

    await expect.poll(() => state.leads.some((lead) => lead.business_name === 'Northstar Cafe')).toBe(true);
    await expect(page.getByText('Northstar Cafe')).toBeVisible();

    await page.getByTestId(`convert-lead-${LEAD_ID}`).click();
    await expect.poll(() => state.deals.some((deal) => deal.lead_id === LEAD_ID)).toBe(true);
    expect(calls.some((call) => call.method === 'POST' && call.table === 'deals')).toBe(true);
  });

  test('creates a deal and updates deal stages', async ({ page }) => {
    const { state } = await mockCrmApis(page);

    await page.goto('/crm/deals');
    await expect(page.getByTestId('crm-page-deals')).toBeVisible();

    await page.getByTestId('new-deal').click();
    await page.getByTestId('deal-title').fill('Peak Dental - $90K MCA');
    await page.getByTestId('deal-requested_amount').fill('90000');
    await page.getByTestId('deal-approved_amount').fill('85000');
    await page.getByTestId('deal-notes').fill('Direct deal created by sales.');
    await page.getByTestId('save-deal').click();

    await expect.poll(() => state.deals.some((deal) => deal.title === 'Peak Dental - $90K MCA')).toBe(true);
    await expect(page.getByText('Peak Dental - $90K MCA')).toBeVisible();

    await page.goto(`/crm/deals/${DEAL_ID}`);
    await page.getByTestId('deal-detail-stage').click();
    await page.getByRole('option', { name: 'Contract Out' }).click();

    await expect.poll(() => state.deals.find((deal) => deal.id === DEAL_ID)?.stage_slug).toBe('contract_sent');
    await expect(page.getByText('Contract Out').first()).toBeVisible();
  });

  test('shows every deal detail tab with renewal calculations and approved-not-accepted offer state', async ({ page }) => {
    await mockCrmApis(page);

    await page.goto(`/crm/deals/${DEAL_ID}`);
    await expect(page.getByTestId('crm-page-atlas-retail')).toBeVisible();

    for (const tab of ['Deal Info', 'financials', 'merchant', 'positions', 'offers', 'documents', 'activity', 'notes', 'renewals']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }

    await page.getByRole('tab', { name: 'offers' }).click();
    await expect(page.getByText('Apex Business Funding')).toBeVisible();
    await expect(page.getByText('presented')).toBeVisible();

    await page.getByRole('tab', { name: 'renewals' }).click();
    await expect(page.getByText('Percent paid down')).toBeVisible();
    await expect(page.getByText('55%', { exact: true })).toBeVisible();
    await expect(page.getByText('Renewal probability')).toBeVisible();
    await expect(page.getByText('72%')).toBeVisible();
  });

  test('loads earnings and reports pages', async ({ page }) => {
    await mockCrmApis(page);

    await page.goto('/crm/earnings');
    await expect(page.getByTestId('crm-page-earnings')).toBeVisible();
    await expect(page.getByText('Gross Commission')).toBeVisible();
    await expect(page.getByText('Unpaid', { exact: true })).toBeVisible();

    await page.goto('/crm/reports');
    await expect(page.getByTestId('crm-page-reports')).toBeVisible();
    await expect(page.getByText('Pipeline Conversion')).toBeVisible();
    await expect(page.getByText('Funding partner performance')).toBeVisible();
  });

  test('creates users only when the current role has admin permission', async ({ page }) => {
    const { state } = await mockCrmApis(page, 'admin');

    await page.goto('/crm/users');
    await expect(page.getByTestId('crm-page-user-management')).toBeVisible();
    await page.getByTestId('create-user').click();
    await page.getByTestId('user-first_name').fill('Jordan');
    await page.getByTestId('user-last_name').fill('Processor');
    await page.getByTestId('user-email').fill('jordan.processor@elitefunding.test');
    await page.getByTestId('save-user').click();

    await expect.poll(() => state.user_profiles.some((user) => user.email === 'jordan.processor@elitefunding.test')).toBe(true);
    await expect(page.getByText('jordan.processor@elitefunding.test')).toBeVisible();

    const salesPage = await page.context().newPage();
    await mockCrmApis(salesPage, 'sales_rep');
    await salesPage.goto('/crm/users');
    await expect(salesPage.getByTestId('crm-page-user-management')).toBeVisible();
    await expect(salesPage.getByTestId('create-user')).toHaveCount(0);
    await salesPage.close();
  });

  test('uploads and previews documents through signed URLs', async ({ page }) => {
    const { state, calls } = await mockCrmApis(page);

    await page.goto('/crm/documents');
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    await page.getByTestId('upload-document').click();
    await page.getByTestId('document-file').setInputFiles({
      name: 'new-bank-statement.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test file'),
    });
    await page.getByTestId('document-description').fill('Uploaded from Playwright.');
    await page.getByTestId('save-document').click();

    await expect.poll(() => state.documents.some((doc) => doc.file_name === 'new-bank-statement.pdf')).toBe(true);
    await expect(page.getByText('new-bank-statement.pdf')).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await page.getByTestId(`preview-document-${DOC_ID}`).click();
    const popup = await popupPromise;
    await expect.poll(() => calls.some((call) => call.table === 'document_signed_url' && call.body.disposition === 'preview')).toBe(true);
    await popup.close();
  });
});
