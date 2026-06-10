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
});
