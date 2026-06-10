import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

function source(filePath: string) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

test.describe('website application signature finalization', () => {
  test('cleans generated signature and PDF artifacts when finalization fails', () => {
    const routeSource = source('app/api/applications/[id]/signature/route.ts');

    expect(routeSource).toContain('cleanupGeneratedSignatureArtifacts');
    expect(routeSource).toContain('generatedStoragePaths.push(signaturePath)');
    expect(routeSource).toContain('generatedStoragePaths.push(pdfPath)');
    expect(routeSource).toContain('documentId: generatedDocumentId');
    expect(routeSource).toContain("supabase.storage.from('application-documents').remove(args.storagePaths)");
    expect(routeSource).toContain("supabase.from('documents').delete()");
  });

  test('generates and attaches the signed Elite PDF during public application submit when signature data is present', () => {
    const submitRouteSource = source('app/api/applications/submit/route.ts');

    expect(submitRouteSource).toContain('signature_data_url: z.string().optional().default');
    expect(submitRouteSource).toContain('decodePngDataUrl(form.signature_data_url)');
    expect(submitRouteSource).toContain('generateLenderApplicationPdf');
    expect(submitRouteSource).toContain("document_type: 'completed_application'");
    expect(submitRouteSource).toContain("application_variant: 'elite_signed_website'");
    expect(submitRouteSource).toContain('signed_application_document_id: completedDocument.id');
    expect(submitRouteSource).toContain('signedApplicationDocumentId: completedApplicationDocumentId');

    const applyFormSource = source('app/(public)/apply/apply-form.tsx');
    expect(applyFormSource).toContain('if (!result.signedApplicationDocumentId)');
  });
});
