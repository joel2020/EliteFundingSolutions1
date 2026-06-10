import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

function source(filePath: string) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

test.describe('generated application artifact cleanup', () => {
  test('centralizes generated PDF cleanup for Supabase storage and document rows', () => {
    const helperSource = source('lib/generated-application-cleanup.ts');

    expect(helperSource).toContain("supabase.storage.from('application-documents').remove(storagePaths)");
    expect(helperSource).toContain(".from('documents')");
    expect(helperSource).toContain(".delete()");
    expect(helperSource).toContain(".eq('organization_id', args.organizationId)");
    expect(helperSource).toContain(".in('id', documentIds)");
    expect(helperSource).toContain('Promise.allSettled(cleanupTasks)');
  });

  test('cleans generated Elite PDFs if route finalization fails', () => {
    const generateRoute = source('app/api/crm/deals/[id]/applications/generate/route.ts');
    const reviewRoute = source('app/api/crm/partner-applications/[id]/route.ts');
    const uploadRoute = source('app/api/crm/deals/[id]/partner-applications/route.ts');
    const submissionRoute = source('app/api/crm/deals/[id]/lender-submissions/route.ts');

    for (const routeSource of [generateRoute, reviewRoute, uploadRoute, submissionRoute]) {
      expect(routeSource).toContain('cleanupGeneratedApplicationArtifacts');
      expect(routeSource).toContain('organizationId: profile.organization_id');
      expect(routeSource).toContain('storagePaths:');
    }

    expect(generateRoute).toContain('documentIds: [document.id]');
    expect(reviewRoute).toContain('documentIds: [document.id]');
    expect(uploadRoute).toContain('documentIds: [convertedDocument.id]');
    expect(submissionRoute).toContain('documentIds: [createdApplicationDocument.id]');
  });
});
