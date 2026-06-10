import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

test.describe('funder submission hardening', () => {
  test('requires explicit confirmation before duplicate active funder sends', () => {
    const routeSource = fs.readFileSync(path.join(repoRoot, 'app/api/crm/deals/[id]/lender-submissions/route.ts'), 'utf8');
    const uiSource = fs.readFileSync(path.join(repoRoot, 'components/crm/crm-platform.tsx'), 'utf8');

    expect(routeSource).toContain('confirm_duplicate_send');
    expect(routeSource).toContain('ACTIVE_FUNDER_SUBMISSION_STATUSES');
    expect(routeSource).toContain('duplicateSubmission');
    expect(routeSource).toContain('{ status: 409 }');
    expect(uiSource).toContain('confirm_duplicate_send');
    expect(uiSource).toContain('isActiveFunderSubmissionStatus');
  });

  test('logs no-email funder submissions for manual follow-up instead of blocking the package', () => {
    const routeSource = fs.readFileSync(path.join(repoRoot, 'app/api/crm/deals/[id]/lender-submissions/route.ts'), 'utf8');

    expect(routeSource).not.toContain('Funding partner has no submission email. Add a submission email before sending this deal.');
    expect(routeSource).toContain('const canSendViaGmail = Boolean(recipientEmail && hasGmailConnection)');
    expect(routeSource).toContain('Funding partner has no submission email. The package was logged for manual follow-up');
    expect(routeSource).toContain("let emailDeliveryStatus = canSendViaGmail ? 'failed' : 'manual_send_required'");
    expect(routeSource).toContain('if (canSendViaGmail)');
  });

  test('blocks draft partner application uploads from automatic funder package conversion', () => {
    const routeSource = fs.readFileSync(path.join(repoRoot, 'app/api/crm/deals/[id]/lender-submissions/route.ts'), 'utf8');

    expect(routeSource).toContain('REVIEWED_PARTNER_APPLICATION_STATUSES');
    expect(routeSource).toContain("new Set(['converted', 'saved_to_deal'])");
    expect(routeSource).toContain('Latest partner application must be reviewed and regenerated into an Elite application before this deal can be sent to funders.');
    expect(routeSource).toContain('latestPartnerApplication && !REVIEWED_PARTNER_APPLICATION_STATUSES.has(latestPartnerApplicationStatus)');
    expect(routeSource).toContain('partnerApplication: {');
    expect(routeSource).toContain('{ status: 409 }');
  });
});
