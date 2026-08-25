import { expect, test } from '@playwright/test';
import { shouldBypassAuthForE2e } from '../lib/e2e-auth-bypass';

test('limits the E2E authentication bypass to local test hosts', () => {
  expect(shouldBypassAuthForE2e('1', '127.0.0.1')).toBe(true);
  expect(shouldBypassAuthForE2e('1', 'localhost')).toBe(true);
  expect(shouldBypassAuthForE2e('1', '[::1]')).toBe(true);
  expect(shouldBypassAuthForE2e('1', 'crm.elitefundingsolution.com')).toBe(false);
  expect(shouldBypassAuthForE2e(undefined, '127.0.0.1')).toBe(false);
});
