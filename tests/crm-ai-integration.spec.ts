import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

test.describe('CRM AI integration wiring', () => {
  test('uses the live partner application upload table in AI deal context', () => {
    const routeSource = fs.readFileSync(path.join(repoRoot, 'app/api/crm/deals/[id]/ai-analysis/route.ts'), 'utf8');
    const aiEngineSource = fs.readFileSync(path.join(repoRoot, 'lib/crm-ai-engine.ts'), 'utf8');

    expect(routeSource).toContain(".from('partner_application_uploads')");
    expect(routeSource).not.toContain(".from('partner_applications')");
    expect(routeSource).toContain('extracted_payload,edited_payload');
    expect(aiEngineSource).toContain('partnerApplications: compactRows(args.partnerApplications, 10)');
  });

  test('keeps LLM output behind deterministic readiness guardrails', () => {
    const aiEngineSource = fs.readFileSync(path.join(repoRoot, 'lib/crm-ai-engine.ts'), 'utf8');

    expect(aiEngineSource).toContain('enforceDeterministicAiGuardrails');
    expect(aiEngineSource).toContain('fallbackApplicationBlockers');
    expect(aiEngineSource).toContain('fallbackDocumentMissing');
    expect(aiEngineSource).toContain('analysis.packageBuilder.readyToSend = false');
    expect(aiEngineSource).toContain('Use the word funder, not lender.');
  });
});
