import { expect, test } from '@playwright/test';
import { extractBankStatementSignals } from '../lib/bank-statement-extraction';

test.describe('bank statement AI extraction', () => {
  test('extracts structured underwriting signals with Azure Responses', async () => {
    const originalFetch = global.fetch;
    process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
    process.env.AZURE_OPENAI_RESPONSES_URL = 'https://azure.test/openai/responses';
    process.env.AI_PROVIDER = 'azure';
    const calls: any[] = [];
    global.fetch = (async (_url: any, init: any) => {
      calls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          bank_name: 'Test Bank',
          account_holder_name: 'Sample Merchant LLC',
          account_last4: '4321',
          statement_period_start: '2026-05-01',
          statement_period_end: '2026-05-31',
          total_deposits: '$85,000',
          deposit_count: '42',
          total_withdrawals: '$72,500',
          beginning_balance: '$10,000',
          ending_balance: '$22,500',
          average_daily_balance: '$18,300',
          lowest_daily_balance: '$4,100',
          negative_days: '0',
          nsf_count: '1',
          overdraft_count: '0',
          revenue_trend: 'stable',
          notes: ['One NSF fee was visible.'],
          missing_fields: [],
          confidence: 'high',
        }),
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    try {
      const extraction = await extractBankStatementSignals({
        fileName: 'may-bank-statement.pdf',
        mimeType: 'application/pdf',
        bytes: Buffer.from('%PDF-1.4 bank statement'),
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].input[0].content.some((part: any) => part.type === 'input_file')).toBe(true);
      expect(extraction.provider).toBe('azure-openai');
      expect(extraction.bank_name).toBe('Test Bank');
      expect(extraction.total_deposits).toBe('$85,000');
      expect(extraction.negative_days).toBe('0');
      expect(extraction.nsf_count).toBe('1');
      expect(extraction.confidence).toBe('high');
    } finally {
      global.fetch = originalFetch;
      delete process.env.AZURE_OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_RESPONSES_URL;
      delete process.env.AI_PROVIDER;
    }
  });
});
