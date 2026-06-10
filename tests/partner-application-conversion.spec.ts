import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

test.describe('partner application conversion hardening', () => {
  test('requires converted partner applications to sync onto the CRM application record', () => {
    const uploadRoute = fs.readFileSync(path.join(repoRoot, 'app/api/crm/deals/[id]/partner-applications/route.ts'), 'utf8');
    const reviewRoute = fs.readFileSync(path.join(repoRoot, 'app/api/crm/partner-applications/[id]/route.ts'), 'utf8');

    expect(uploadRoute).toContain('applicationSyncError');
    expect(uploadRoute).toContain('CRM application record could not be finalized');
    expect(reviewRoute).toContain('partnerApplicationUpdateError');
    expect(reviewRoute).toContain('applicationSyncError');
    expect(reviewRoute).toContain('no CRM application record is linked');
  });
});
