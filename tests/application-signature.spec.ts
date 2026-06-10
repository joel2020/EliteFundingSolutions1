import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

test.describe('website application signature finalization', () => {
  test('cleans generated signature and PDF artifacts when finalization fails', () => {
    const routeSource = fs.readFileSync(path.join(repoRoot, 'app/api/applications/[id]/signature/route.ts'), 'utf8');

    expect(routeSource).toContain('cleanupGeneratedSignatureArtifacts');
    expect(routeSource).toContain('generatedStoragePaths.push(signaturePath)');
    expect(routeSource).toContain('generatedStoragePaths.push(pdfPath)');
    expect(routeSource).toContain('documentId: generatedDocumentId');
    expect(routeSource).toContain("supabase.storage.from('application-documents').remove(args.storagePaths)");
    expect(routeSource).toContain("supabase.from('documents').delete()");
  });
});
