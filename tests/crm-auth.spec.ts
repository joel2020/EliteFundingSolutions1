import { expect, test } from '@playwright/test';
import { safePostLoginRedirect } from '../lib/auth-redirect';

test.describe('post-login redirects', () => {
  test('resumes an allowed route within the authenticated area', () => {
    expect(safePostLoginRedirect('/crm/settings', '/crm')).toBe('/crm/settings');
    expect(safePostLoginRedirect('/portal/documents?filter=open', '/portal')).toBe('/portal/documents?filter=open');
  });

  test('rejects external and cross-role redirect targets', () => {
    expect(safePostLoginRedirect('https://example.com/phishing', '/crm')).toBe('/crm');
    expect(safePostLoginRedirect('//example.com/phishing', '/crm')).toBe('/crm');
    expect(safePostLoginRedirect('/portal', '/crm')).toBe('/crm');
    expect(safePostLoginRedirect('/crm', '/portal')).toBe('/portal');
  });
});
