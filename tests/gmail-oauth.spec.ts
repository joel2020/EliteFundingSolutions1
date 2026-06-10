import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { GMAIL_SCOPES, getConfiguredRedirectUri, hasRequiredGmailSendScope } from '../lib/gmail';

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

  test('requires Gmail send scope before reporting or using a connection', () => {
    expect(hasRequiredGmailSendScope('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.send')).toBe(true);
    expect(hasRequiredGmailSendScope('https://www.googleapis.com/auth/userinfo.email')).toBe(false);

    const callbackSource = fs.readFileSync(path.join(repoRoot, 'app/api/gmail/callback/route.ts'), 'utf8');
    const statusSource = fs.readFileSync(path.join(repoRoot, 'app/api/gmail/status/route.ts'), 'utf8');
    const sendSource = fs.readFileSync(path.join(repoRoot, 'app/api/gmail/send/route.ts'), 'utf8');
    const submissionSource = fs.readFileSync(path.join(repoRoot, 'app/api/crm/deals/[id]/lender-submissions/route.ts'), 'utf8');
    expect(callbackSource).toContain('missing_gmail_send_scope');
    expect(statusSource).toContain('missing_gmail_send_scope');
    expect(sendSource).toContain('missing_gmail_send_scope');
    expect(submissionSource).toContain('hasRequiredGmailSendScope(gmailTokens.scope)');
  });

  test('Settings explains reconnect states needed for Google review', () => {
    const connectionSource = fs.readFileSync(path.join(repoRoot, 'components/gmail/gmail-connection.tsx'), 'utf8');
    const settingsToastSource = fs.readFileSync(path.join(repoRoot, 'app/(crm)/crm/settings/settings-client.tsx'), 'utf8');
    const checklistSource = fs.readFileSync(path.join(repoRoot, 'docs/google-oauth-demo-checklist.md'), 'utf8');

    expect(connectionSource).toContain('needsReconnect');
    expect(connectionSource).toContain('missing_gmail_send_scope');
    expect(connectionSource).toContain('gmail_token_expired');
    expect(connectionSource).toContain('Reconnect required');
    expect(settingsToastSource).toContain('missing_gmail_send_scope');
    expect(settingsToastSource).toContain('invalid_state');
    expect(settingsToastSource).toContain('callback_error');
    expect(checklistSource).toContain('Settings shows a clear reconnect warning');
  });

  test('funder package sending persists refreshed Gmail tokens', () => {
    const submissionRouteSource = fs.readFileSync(path.join(repoRoot, 'app/api/crm/deals/[id]/lender-submissions/route.ts'), 'utf8');
    expect(submissionRouteSource).toContain('sendGmailEmail({');
    expect(submissionRouteSource).toContain('userId: user.id');
  });
});
