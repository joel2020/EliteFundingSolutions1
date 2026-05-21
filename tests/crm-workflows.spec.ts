import { expect, test } from '@playwright/test';
import { DEAL_ID, DOC_ID, LEAD_ID, ORG_ID, mockCrmApis } from './helpers/crm-fixtures';

test.describe('Elite Funding Solutions CRM workflows', () => {
  test('login and logout', async ({ page }) => {
    const { calls } = await mockCrmApis(page);

    await page.goto('/login');
    await page.getByTestId('login-email').fill('admin@elitefunding.test');
    await page.getByTestId('login-password').fill('password-123');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/crm$/);
    await expect(page.getByTestId('crm-page-executive-dashboard')).toBeVisible();
    expect(calls.some((call) => call.table === 'login_event_api')).toBe(true);

    await page.getByTestId('crm-sign-out').click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('renders the Nexus shell across authenticated CRM routes', async ({ page }) => {
    await mockCrmApis(page);

    const routes = [
      '/crm',
      '/crm/leads',
      '/crm/deals',
      '/crm/offers',
      '/crm/tasks',
      '/crm/renewals',
      '/crm/earnings',
      '/crm/reports',
      '/crm/archive',
      '/crm/tools',
      '/crm/users',
      '/crm/settings',
    ];

    for (const route of routes) {
      await page.goto(route);
      const shell = page.getByTestId('crm-nexus-shell');
      await expect(shell).toBeVisible();
      await expect(shell).toContainText('Elite CRM Nexus v2');
      await expect(page.getByLabel('Notifications coming soon')).toHaveCount(0);
      for (const label of ['Dashboard', 'Leads', 'Deals', 'Offers', 'Tasks', 'Renewals', 'Earnings', 'Reports', 'Archive', 'Tools', 'Users', 'Settings', 'Search Deals', 'Elite Connect', 'Logout']) {
        await expect(shell.getByText(label, { exact: true })).toBeVisible();
      }
    }
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

  test('bulk imports leads from CSV', async ({ page }) => {
    const { state, calls } = await mockCrmApis(page);

    await page.goto('/crm/leads');
    await expect(page.getByTestId('crm-page-leads')).toBeVisible();

    await page.getByTestId('import-leads').click();
    await page.getByTestId('lead-import-file').setInputFiles({
      name: 'elite-leads.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('business_name,first_name,last_name,phone,email,lead_source,requested_amount,notes\nBlue Oak Cafe,Bianca,Reed,2125550101,bianca@blueoak.test,iso,65000,Needs fast review\nMetro Supply,Marco,Vega,7185550133,marco@metro.test,referral,120000,Has two locations'),
    });
    await expect(page.getByText('Blue Oak Cafe')).toBeVisible();
    await page.getByTestId('save-lead-import').click();

    await expect.poll(() => state.leads.some((lead) => lead.business_name === 'Blue Oak Cafe')).toBe(true);
    await expect.poll(() => state.leads.some((lead) => lead.business_name === 'Metro Supply')).toBe(true);
    expect(calls.some((call) => call.method === 'POST' && call.table === 'leads' && Array.isArray(call.body) && call.body.length === 2)).toBe(true);
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

    for (const tab of ['Overview', 'Readiness', 'Applications', 'Documents', 'Notes', 'Lenders Sent To', 'Offers', 'Finance', 'History', 'Tasks', 'Activity']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }

    await page.getByRole('tab', { name: 'Offers' }).click();
    await expect(page.getByText('Apex Business Funding').first()).toBeVisible();
    await expect(page.getByText('presented')).toBeVisible();
    await expect(page.getByText('Recommended Offer')).toBeVisible();

    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByTestId('merchant-history-view')).toContainText('Atlas Retail #1');
    await expect(page.getByTestId('merchant-history-view')).toContainText('defaulted with Apex Business Funding');
  });

  test('uploads partner applications, generates Elite PDFs, and creates completion links', async ({ page }) => {
    const { state, calls } = await mockCrmApis(page);

    await page.goto(`/crm/deals/${DEAL_ID}`);
    await expect(page.getByTestId('crm-page-atlas-retail')).toBeVisible();
    await page.getByRole('tab', { name: 'Applications' }).click();

    await page.getByTestId('deal-upload-partner-application').click();
    await page.getByTestId('partner-application-file').setInputFiles({
      name: 'partner-app.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 partner app'),
    });
    await page.getByTestId('partner-application-source').fill('Apex Business Funding');
    await page.getByTestId('partner-application-notes').fill('Received from partner portal.');
    await page.getByTestId('save-partner-application').click();

    await expect.poll(() => state.partner_application_uploads.some((row) => row.original_file_name === 'partner-app.pdf')).toBe(true);
    await page.getByRole('tab', { name: 'Applications' }).click();
    await expect(page.getByText('Original partner application')).toBeVisible();

    await page.getByTestId('deal-generate-elite-application').click();
    await expect.poll(() => state.documents.some((doc) => doc.application_variant === 'elite_generated')).toBe(true);
    await page.getByRole('tab', { name: 'Applications' }).click();

    await page.getByTestId('deal-send-application-link').click();
    await page.getByTestId('application-link-email').fill('owner@atlas.test');
    await page.getByTestId('save-application-link').click();
    await expect(page.getByText('/apply?deal=deal_mock_completion_token')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Applications' }).click();

    await page.getByRole('button', { name: /Reveal full fields/i }).click();
    await expect(page.getByText('123-45-6789')).toBeVisible();
    await expect(page.getByText('Application disclosure preview')).toBeVisible();
    await expect(page.getByText('Credit Review Consent').first()).toBeVisible();
    expect(calls.some((call) => call.table === 'partner_application_uploads_api')).toBe(true);
    expect(calls.some((call) => call.table === 'application_generate_api')).toBe(true);
    expect(calls.some((call) => call.table === 'application_link_api')).toBe(true);
    expect(calls.some((call) => call.table === 'application_sensitive_api')).toBe(true);
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

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export pack' }).click();
    expect((await downloadPromise).suggestedFilename()).toBe('crm-report-pack.csv');
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

    const createdUser = state.user_profiles.find((user) => user.email === 'jordan.processor@elitefunding.test')!;
    await expect(page.getByRole('row', { name: /Jordan Processor/ })).toContainText(`/apply/rep/${createdUser.referral_token}`);
    await expect(page.getByRole('row', { name: /Jordan Processor/ })).not.toContainText('jordan-processor');
    await page.getByTestId(`edit-user-${createdUser.id}`).click();
    await page.getByTestId('user-first_name').fill('Jordan Updated');
    await page.getByTestId('save-user').click();
    await expect.poll(() => state.user_profiles.find((user) => user.id === createdUser.id)?.first_name).toBe('Jordan Updated');
    await expect(page.getByText('Jordan Updated')).toBeVisible();

    await page.getByRole('row', { name: /Jordan Updated/ }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Confirm Deletion')).toBeVisible();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expect.poll(() => state.user_profiles.find((user) => user.id === createdUser.id)?.deleted_at).toBeTruthy();
    await expect(page.getByText('Jordan Updated')).toHaveCount(0);

    const salesPage = await page.context().newPage();
    await mockCrmApis(salesPage, 'sales_rep');
    await salesPage.goto('/crm/users');
    await expect(salesPage.getByTestId('crm-page-user-management')).toBeVisible();
    await expect(salesPage.getByTestId('create-user')).toHaveCount(0);
    await salesPage.close();
  });

  test('restores archived lenders, brokers, and users from the archive center', async ({ page }) => {
    const { state, calls } = await mockCrmApis(page, 'admin');
    page.on('dialog', async (dialog) => dialog.accept());
    const archivedAt = '2026-05-20T12:00:00.000Z';
    state.funding_partners.unshift({
      id: 'archived-lender-1',
      organization_id: ORG_ID,
      name: 'Archived Capital',
      email: 'archive-lender@example.test',
      is_active: false,
      deleted_at: archivedAt,
    });
    state.iso_brokers.unshift({
      id: 'archived-broker-1',
      organization_id: ORG_ID,
      company_name: 'Archived ISO Group',
      broker_name: 'Blake Broker',
      email: 'archive-broker@example.test',
      is_active: false,
      deleted_at: archivedAt,
    });
    state.user_profiles.unshift({
      id: 'archived-user-1',
      user_id: 'auth-archived-user-1',
      organization_id: ORG_ID,
      email: 'archived.user@elitefunding.test',
      first_name: 'Archived',
      last_name: 'User',
      role: 'sales_rep',
      is_active: false,
      deleted_at: archivedAt,
    });

    await page.goto('/crm/archive');
    await expect(page.getByTestId('archive-lenders-archived-lender-1')).toContainText('Archived Capital');
    await page.getByTestId('restore-lenders-archived-lender-1').click();
    await expect.poll(() => state.funding_partners.find((partner) => partner.id === 'archived-lender-1')?.deleted_at).toBeNull();

    await page.getByRole('tab', { name: /Brokers/ }).click();
    await expect(page.getByTestId('archive-brokers-archived-broker-1')).toContainText('Archived ISO Group');
    await page.getByTestId('restore-brokers-archived-broker-1').click();
    await expect.poll(() => state.iso_brokers.find((broker) => broker.id === 'archived-broker-1')?.deleted_at).toBeNull();

    await page.getByRole('tab', { name: /Users/ }).click();
    await expect(page.getByTestId('archive-users-archived-user-1')).toContainText('Archived User');
    await page.getByTestId('restore-users-archived-user-1').click();
    await expect.poll(() => state.user_profiles.find((user) => user.id === 'archived-user-1')?.deleted_at).toBeNull();

    expect(calls.some((call) => call.table === 'funding_partners_restore_api')).toBe(true);
    expect(calls.some((call) => call.table === 'iso_brokers_restore_api')).toBe(true);
    expect(calls.some((call) => call.table === 'user_profiles_restore_api')).toBe(true);
  });



  test('deal detail command center workflows render and log operational events', async ({ page }) => {
    const { state, calls } = await mockCrmApis(page);

    await page.goto(`/crm/deals/${DEAL_ID}`);
    await expect(page.getByTestId('crm-page-atlas-retail')).toBeVisible();
    await expect(page.getByText('Submission Ready')).toBeVisible();

    await page.getByRole('tab', { name: 'Readiness' }).click();
    await expect(page.getByText('Submission readiness')).toBeVisible();
    await expect(page.getByTestId('missing-document-checklist')).toContainText('Voided check');

    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByText('Missing required documents')).toBeVisible();
    await expect(page.getByText('Bank Statement').first()).toBeVisible();

    await page.getByTestId('deal-upload-document').click();
    await page.getByTestId('deal-document-file').setInputFiles({ name: 'voided-check.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 voided check') });
    await page.getByTestId('deal-document-type').click();
    await page.getByRole('option', { name: 'Other' }).click();
    await page.getByTestId('deal-save-document').click();
    await expect.poll(() => state.documents.some((doc) => doc.file_name === 'voided-check.pdf' && doc.deal_id === DEAL_ID)).toBe(true);

    await page.getByRole('tab', { name: 'Notes' }).click();
    await page.getByTestId('deal-add-note').click();
    await page.getByTestId('deal-note-body').fill('Processor requested final statements.');
    await page.getByTestId('deal-save-note').click();
    await expect.poll(() => state.activities.some((activity) => activity.activity_type === 'note' && String(activity.body).includes('Processor requested'))).toBe(true);

    await page.getByRole('tab', { name: 'Lenders Sent To' }).click();
    await page.getByTestId('deal-submit-lender').click();
    await expect(page.getByTestId('lender-default-warning')).toContainText('Prior default with this lender');
    await page.getByTestId('deal-submission-notes').fill('Strong deposits, explain two negative days from tax payment timing.');
    await page.getByTestId('deal-save-submission').click();
    await expect.poll(() => state.activities.some((activity) => activity.activity_type === 'partner_submission')).toBe(true);
    expect(calls.some((call) => call.method === 'POST' && call.table === 'partner_submissions')).toBe(true);

    await page.getByRole('tab', { name: 'Offers' }).click();
    await expect(page.getByTestId('offer-comparison-view')).toContainText('Recommended Offer');

    await page.getByRole('tab', { name: 'Tasks' }).click();
    await expect(page.getByText('Follow up with Apex')).toBeVisible();
  });

  test('deal detail command center empty states render without documents, lenders, or offers', async ({ page }) => {
    const { state } = await mockCrmApis(page);
    state.documents = [];
    state.partner_submissions = [];
    state.offers = [];
    state.tasks = [];

    await page.goto(`/crm/deals/${DEAL_ID}`);
    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByText('No documents attached.')).toBeVisible();
    await page.getByRole('tab', { name: 'Lenders Sent To' }).click();
    await expect(page.getByText('No lender submissions yet.')).toBeVisible();
    await page.getByRole('tab', { name: 'Offers' }).click();
    await expect(page.getByText('No offers received yet.')).toBeVisible();
  });

  test('creates funding partners and presents offers from CRM action buttons', async ({ page }) => {
    const { state, calls } = await mockCrmApis(page, 'admin');

    await page.goto('/crm/partners');
    await page.getByTestId('add-partner').click();
    await page.getByTestId('partner-name').fill('Keystone Capital');
    await page.getByTestId('partner-contact-name').fill('Kim Partner');
    await page.getByTestId('partner-email').fill('kim@keystone.test');
    const partnerResponse = page.waitForResponse('**/api/crm/partners');
    await page.getByTestId('save-partner').click();
    await expect.poll(async () => (await partnerResponse).ok()).toBe(true);
    await expect.poll(() => state.funding_partners.some((partner) => partner.name === 'Keystone Capital')).toBe(true);
    expect(calls.some((call) => call.table === 'funding_partners_api' && call.body.name === 'Keystone Capital')).toBe(true);
    await expect(page.getByText('Keystone Capital')).toBeVisible();

    const createdPartner = state.funding_partners.find((partner) => partner.name === 'Keystone Capital')!;
    await page.getByTestId(`partner-card-${createdPartner.id}`).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Yes, Delete' }).click();
    await expect.poll(() => state.funding_partners.find((partner) => partner.id === createdPartner.id)?.deleted_at).toBeTruthy();
    await expect(page.getByText('Keystone Capital')).toHaveCount(0);

    await page.goto('/crm/offers');
    await page.getByTestId('create-offer').click();
    await page.getByTestId('offer-deal').click();
    await page.getByRole('option', { name: 'Atlas Retail - $75K MCA' }).click();
    await page.getByTestId('offer-approved-amount').fill('123000');
    await page.getByTestId('save-offer').click();
    await expect.poll(() => state.offers.find((offer) => offer.approved_amount === 123000)?.status).toBe('received');

    const createdOffer = state.offers.find((offer) => offer.approved_amount === 123000)!;
    await page.getByTestId(`present-offer-${createdOffer.id}`).click();
    await expect.poll(() => state.offers.find((offer) => offer.id === createdOffer.id)?.status).toBe('presented');
  });

  test('uploads and previews deal documents through signed URLs', async ({ page }) => {
    const { state, calls } = await mockCrmApis(page);

    await page.goto(`/crm/deals/${DEAL_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('crm-page-atlas-retail')).toBeVisible();
    await page.getByRole('tab', { name: 'Documents' }).click();

    await page.getByTestId('deal-upload-document').click();
    await page.getByTestId('deal-document-file').setInputFiles({
      name: 'new-bank-statement.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test file'),
    });
    await page.getByTestId('deal-document-description').fill('Uploaded from Playwright.');
    await page.getByTestId('deal-save-document').click();

    await expect.poll(() => state.documents.some((doc) => doc.file_name === 'new-bank-statement.pdf' && doc.deal_id === DEAL_ID)).toBe(true);
    await expect(page.getByText('new-bank-statement.pdf').first()).toBeVisible();

    const signedUrlResponse = await page.evaluate(async (docId) => {
      const response = await fetch(`/api/documents/${docId}/signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition: 'preview' }),
      });
      return response.json();
    }, DOC_ID);
    await expect.poll(() => calls.some((call) => call.table === 'document_signed_url' && call.body.disposition === 'preview')).toBe(true);
    expect(signedUrlResponse.url).toBe('https://signed.example/atlas-bank-statements.pdf');
  });
});
