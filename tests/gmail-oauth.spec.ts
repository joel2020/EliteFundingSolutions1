import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { GMAIL_SCOPES, getConfiguredRedirectUri } from '../lib/gmail';

const repoRoot = path.resolve(__dirname, '..');

test.describe('Google OAuth verification readiness', () => {
  test('requests only outbound Gmail send and basic identity scopes', () => {
    expect(GMAIL_SCOPES).toEqual([
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ]);
  });

  test('builds the Gmail callback URL on the CRM origin', () => {
    const originalGoogleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
    const originalCrmUrl = process.env.NEXT_PUBLIC_CRM_URL;
    const originalCrmAppUrl = process.env.CRM_APP_URL;
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    try {
      delete process.env.GOOGLE_REDIRECT_URI;
      delete process.env.NEXT_PUBLIC_CRM_URL;
      delete process.env.CRM_APP_URL;
      process.env.NEXT_PUBLIC_APP_URL = 'https://www.elitefundingsolution.com';

      expect(getConfiguredRedirectUri()).toBe('https://crm.elitefundingsolution.com/api/gmail/callback');

      process.env.NEXT_PUBLIC_CRM_URL = 'https://crm.elitefundingsolution.com/';
      expect(getConfiguredRedirectUri()).toBe('https://crm.elitefundingsolution.com/api/gmail/callback');
    } finally {
      if (originalGoogleRedirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI;
      else process.env.GOOGLE_REDIRECT_URI = originalGoogleRedirectUri;
      if (originalCrmUrl === undefined) delete process.env.NEXT_PUBLIC_CRM_URL;
      else process.env.NEXT_PUBLIC_CRM_URL = originalCrmUrl;
      if (originalCrmAppUrl === undefined) delete process.env.CRM_APP_URL;
      else process.env.CRM_APP_URL = originalCrmAppUrl;
      if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  test('does not include Gmail inbox read/list API calls', () => {
    const gmailSource = fs.readFileSync(path.join(repoRoot, 'lib/gmail.ts'), 'utf8');
    expect(gmailSource).not.toContain('gmail.users.messages.list');
    expect(gmailSource).not.toContain('gmail.users.messages.get');
    expect(gmailSource).toContain('gmail.users.messages.send');
  });

  test('funder package sending persists refreshed Gmail tokens', () => {
    const submissionRouteSource = fs.readFileSync(path.join(repoRoot, 'app/api/crm/deals/[id]/lender-submissions/route.ts'), 'utf8');
    expect(submissionRouteSource).toContain('sendGmailEmail({');
    expect(submissionRouteSource).toContain('userId: user.id');
  });
});
