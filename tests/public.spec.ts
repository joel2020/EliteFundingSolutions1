import { expect, test } from '@playwright/test';

const publicRoutes = ['/', '/funding-solutions', '/industries', '/about', '/faq', '/resources', '/blog', '/contact', '/apply'];

test.describe('public site production smoke tests', () => {
  for (const route of publicRoutes) {
    test(`${route} loads without a 404`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator('body')).toBeVisible();
    });
  }

  test('mobile menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /toggle mobile navigation/i });
    await toggle.click();
    await expect(page.getByRole('navigation', { name: /mobile navigation/i })).toBeVisible();
    await toggle.click();
    await expect(page.getByRole('navigation', { name: /mobile navigation/i })).toBeHidden();
  });

  test('FAQ content is server-rendered and expandable', async ({ page }) => {
    await page.goto('/faq');
    await expect(page.getByText('What is a merchant cash advance?')).toBeVisible();
    await page.getByText('What is a merchant cash advance?').click();
    await expect(page.getByText(/purchases a portion of your future receivables/i)).toBeVisible();
  });

  test('contact form validates required fields', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: /send message/i }).click();
    await expect(page.getByText(/please provide your name/i)).toBeVisible();
  });
});
