import { test, expect } from '@playwright/test';
import { mockCrmApis } from './helpers/crm-fixtures';

test.describe('CRM reliability errors', () => {
  test('recovers when the CRM notification poll detects an expired session', async ({ page }) => {
    await mockCrmApis(page);
    await page.route('**/api/crm/notifications', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      });
    });

    await page.goto('/crm/deals');

    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcrm%2Fdeals/);
  });

  test('shows a pipeline load error instead of an empty deals table', async ({ page }) => {
    await mockCrmApis(page);
    await page.route('**/rest/v1/deals**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST301', message: 'CRM session expired. Please sign in again.' }),
      });
    });

    await page.goto('/crm/deals');

    await expect(page.getByText('Unable to load the CRM pipeline. Please sign in again or retry.')).toBeVisible();
    await expect(page.getByText('CRM session expired. Please sign in again.')).toHaveCount(0);
    await expect(page.getByText('No deals found')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  });

  test('retry refreshes the CRM profile after a transient profile failure', async ({ page }) => {
    await mockCrmApis(page);
    let profileRequests = 0;
    let profileAvailable = false;
    await page.route('**/api/crm/me', async (route) => {
      profileRequests += 1;
      if (!profileAvailable) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Unable to load your CRM profile.' }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/crm/deals');
    await expect(page.getByText('Unable to load your CRM profile.')).toBeVisible();

    profileAvailable = true;
    await page.getByRole('button', { name: 'Retry' }).click();

    await expect(page.getByText('Unable to load your CRM profile.')).toHaveCount(0);
    expect(profileRequests).toBeGreaterThanOrEqual(2);
  });

  test('sends an expired Gmail connection session back through login', async ({ page }) => {
    await mockCrmApis(page);
    await page.route('**/api/gmail/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, connected: false, email: null, needsReconnect: false }),
      });
    });
    await page.route('**/api/gmail/auth', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      });
    });

    await page.goto('/crm/settings');
    await page.getByRole('button', { name: 'Connect Google Workspace' }).click();

    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcrm%2Fsettings/);
  });

  test('shows a Gmail permission error without starting a login loop', async ({ page }) => {
    await mockCrmApis(page);
    await page.route('**/api/gmail/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, connected: false, email: null, needsReconnect: false }),
      });
    });
    await page.route('**/api/gmail/auth', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'You do not have permission to connect Gmail.' }),
      });
    });

    await page.goto('/crm/settings');
    await page.getByRole('button', { name: 'Connect Google Workspace' }).click();

    await expect(page).toHaveURL(/\/crm\/settings$/);
    await expect(page.getByText('You do not have permission to connect Gmail.')).toBeVisible();
  });

  test('returns to CRM Settings after an expired-session password login', async ({ page }) => {
    await mockCrmApis(page);

    await page.goto('/login?redirectTo=%2Fcrm%2Fsettings');
    await page.getByTestId('login-email').fill('admin@elitefunding.test');
    await page.getByTestId('login-password').fill('correct-password');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/crm\/settings$/);
  });

  test('preserves the CRM Settings return path when Google login is selected', async ({ page }) => {
    await mockCrmApis(page);
    await page.route('**/api/auth/google**', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/login?redirectTo=%2Fcrm%2Fsettings');
    const googleRequest = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/auth/google');
    await page.getByTestId('login-google').click();

    expect(new URL((await googleRequest).url()).searchParams.get('redirectTo')).toBe('/crm/settings');
  });
});
