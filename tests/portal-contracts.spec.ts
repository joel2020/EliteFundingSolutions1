import { expect, test } from '@playwright/test';

test.describe('client portal contract signing', () => {
  test('lets a client sign a ready contract with E-SIGN consent', async ({ page }) => {
    let signPayload: any = null;

    await page.addInitScript(() => {
      const session = {
        access_token: 'mock-client-access-token',
        refresh_token: 'mock-client-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'client-user-1', email: 'owner@atlas.test' },
      };
      const encodedSession = btoa(JSON.stringify(session)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
      window.localStorage.setItem('sb-mdrrcrmowurbrwvdsgnq-auth-token', JSON.stringify(session));
      document.cookie = `sb-mdrrcrmowurbrwvdsgnq-auth-token=base64-${encodedSession}; path=/; SameSite=Lax`;
    });

    await page.route('**/auth/v1/user**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'client-user-1', email: 'owner@atlas.test' }),
      });
    });

    await page.route('**/rest/v1/applications**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'app-1',
            organization_id: '00000000-0000-0000-0000-000000000001',
            status: 'approved',
            requested_amount: 75000,
            created_at: '2026-05-14T12:00:00.000Z',
            submitted_at: '2026-05-14T12:00:00.000Z',
            lead_id: 'lead-1',
            businesses: { legal_name: 'Atlas Retail LLC', dba: 'Atlas Retail' },
            leads: { email: 'owner@atlas.test' },
          },
        ]),
      });
    });

    await page.route('**/rest/v1/documents**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/rest/v1/offers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/portal/contracts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          contracts: [
            {
              id: 'contract-1',
              contract_type: 'mca',
              status: 'viewed',
              sent_date: '2026-05-14T12:00:00.000Z',
              signed_date: null,
              funded_amount: 70000,
              has_signed_file: false,
              business_name: 'Atlas Retail LLC',
            },
          ],
        }),
      });
    });

    await page.route('**/api/portal/contracts/contract-1/sign', async (route) => {
      signPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          contract: {
            id: 'contract-1',
            status: 'signed',
            signed_date: '2026-05-14T12:10:00.000Z',
            has_signed_file: true,
          },
        }),
      });
    });

    await page.goto('/portal');
    await page.getByRole('tab', { name: 'Contracts' }).click();
    await expect(page.getByText('Atlas Retail LLC')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign' }).click();
    await page.getByLabel('Full Legal Name').fill('Jordan Lee');
    await page.getByText('I consent to use electronic records').click();
    await page.getByRole('button', { name: 'Sign Contract' }).click();

    await expect.poll(() => signPayload?.signature_name).toBe('Jordan Lee');
    expect(signPayload.esign_consent_accepted).toBe(true);
    await expect(page.getByText('Contract signed successfully.')).toBeVisible();
  });
});
