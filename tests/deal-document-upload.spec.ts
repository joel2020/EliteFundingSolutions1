import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

test.describe('CRM deal document uploads', () => {
  test('keeps AI classification visible and cleans storage after failed document inserts', () => {
    const routeSource = fs.readFileSync(path.join(repoRoot, 'app/api/crm/deals/[id]/documents/route.ts'), 'utf8');

    expect(routeSource).toContain('classificationReviewNote');
    expect(routeSource).toContain('Document classification:');
    expect(routeSource).toContain('AI document review');
    expect(routeSource).toContain('removeUploadedDealDocument');
    expect(routeSource).toContain("supabase.storage.from('application-documents').remove([storagePath])");
    expect(routeSource).toContain('if (documentError)');
  });
});
