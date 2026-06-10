type RecordMap = Record<string, any>;

const AI_PROVIDER = (process.env.AI_PROVIDER || 'azure').toLowerCase();
const ALLOW_OPENAI_FALLBACK = process.env.ALLOW_OPENAI_FALLBACK === 'true';
const AI_MAX_BYTES = 10 * 1024 * 1024;

export type BankStatementExtraction = {
  document_type: 'bank_statement';
  provider: 'azure-openai' | 'openai' | 'rules';
  confidence: 'low' | 'medium' | 'high';
  bank_name: string;
  account_holder_name: string;
  account_last4: string;
  statement_period_start: string;
  statement_period_end: string;
  total_deposits: string;
  deposit_count: string;
  total_withdrawals: string;
  beginning_balance: string;
  ending_balance: string;
  average_daily_balance: string;
  lowest_daily_balance: string;
  negative_days: string;
  nsf_count: string;
  overdraft_count: string;
  revenue_trend: 'increasing' | 'stable' | 'declining' | 'unknown';
  notes: string[];
  missing_fields: string[];
  error?: string;
};

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'bank_name',
    'account_holder_name',
    'account_last4',
    'statement_period_start',
    'statement_period_end',
    'total_deposits',
    'deposit_count',
    'total_withdrawals',
    'beginning_balance',
    'ending_balance',
    'average_daily_balance',
    'lowest_daily_balance',
    'negative_days',
    'nsf_count',
    'overdraft_count',
    'revenue_trend',
    'notes',
    'missing_fields',
    'confidence',
  ],
  properties: {
    bank_name: { type: 'string' },
    account_holder_name: { type: 'string' },
    account_last4: { type: 'string' },
    statement_period_start: { type: 'string' },
    statement_period_end: { type: 'string' },
    total_deposits: { type: 'string' },
    deposit_count: { type: 'string' },
    total_withdrawals: { type: 'string' },
    beginning_balance: { type: 'string' },
    ending_balance: { type: 'string' },
    average_daily_balance: { type: 'string' },
    lowest_daily_balance: { type: 'string' },
    negative_days: { type: 'string' },
    nsf_count: { type: 'string' },
    overdraft_count: { type: 'string' },
    revenue_trend: { type: 'string', enum: ['increasing', 'stable', 'declining', 'unknown'] },
    notes: { type: 'array', items: { type: 'string' } },
    missing_fields: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean).slice(0, 16);
}

function extractOutputText(response: RecordMap) {
  if (typeof response.output_text === 'string') return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

function fileContentPart(fileName: string, mimeType: string | null | undefined, bytes: Buffer) {
  const type = mimeType || 'application/octet-stream';
  const dataUrl = `data:${type};base64,${bytes.toString('base64')}`;
  if (type.startsWith('image/')) return { type: 'input_image', image_url: dataUrl };
  return { type: 'input_file', filename: fileName, file_data: dataUrl };
}

function buildPrompt(fileName: string) {
  return [
    'Extract underwriting signals from this business bank statement for a merchant cash advance CRM.',
    'Return only JSON matching the schema.',
    'Use exact values from the statement. Do not invent values.',
    'If a value is unavailable, return an empty string and add it to missing_fields.',
    'For total_deposits, use gross credits/deposits for the statement period when visible.',
    'For negative_days, count days where the daily/ledger balance is below zero when visible; otherwise leave blank.',
    'For nsf_count and overdraft_count, count explicit NSF, returned item, insufficient funds, overdraft, or OD fee events when visible.',
    'Use ISO dates when possible.',
    `Filename: ${fileName}`,
  ].join('\n');
}

function normalizeExtraction(value: RecordMap, provider: BankStatementExtraction['provider']): BankStatementExtraction {
  return {
    document_type: 'bank_statement',
    provider,
    confidence: ['low', 'medium', 'high'].includes(value?.confidence) ? value.confidence : 'medium',
    bank_name: text(value?.bank_name),
    account_holder_name: text(value?.account_holder_name),
    account_last4: text(value?.account_last4).replace(/\D/g, '').slice(-4),
    statement_period_start: text(value?.statement_period_start),
    statement_period_end: text(value?.statement_period_end),
    total_deposits: text(value?.total_deposits),
    deposit_count: text(value?.deposit_count),
    total_withdrawals: text(value?.total_withdrawals),
    beginning_balance: text(value?.beginning_balance),
    ending_balance: text(value?.ending_balance),
    average_daily_balance: text(value?.average_daily_balance),
    lowest_daily_balance: text(value?.lowest_daily_balance),
    negative_days: text(value?.negative_days),
    nsf_count: text(value?.nsf_count),
    overdraft_count: text(value?.overdraft_count),
    revenue_trend: ['increasing', 'stable', 'declining', 'unknown'].includes(value?.revenue_trend) ? value.revenue_trend : 'unknown',
    notes: stringList(value?.notes),
    missing_fields: stringList(value?.missing_fields),
  };
}

async function generateAzureExtraction(args: { fileName: string; mimeType?: string | null; bytes: Buffer }) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const responsesUrl = process.env.AZURE_OPENAI_RESPONSES_URL;
  if (!apiKey || !responsesUrl || args.bytes.length > AI_MAX_BYTES) return null;

  const response = await fetch(responsesUrl, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.AZURE_OPENAI_MODEL || 'gpt-4.1-mini',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: buildPrompt(args.fileName) },
          fileContentPart(args.fileName, args.mimeType, args.bytes),
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'elite_bank_statement_extraction',
          schema: extractionSchema,
          strict: true,
        },
      },
      max_output_tokens: 1800,
    }),
  });
  if (!response.ok) throw new Error(`Azure bank statement extraction failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const outputText = extractOutputText(await response.json());
  if (!outputText) throw new Error('Azure bank statement extraction returned no JSON.');
  return normalizeExtraction(JSON.parse(outputText), 'azure-openai');
}

async function generateOpenAiExtraction(args: { fileName: string; mimeType?: string | null; bytes: Buffer }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || args.bytes.length > AI_MAX_BYTES) return null;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: buildPrompt(args.fileName) },
          fileContentPart(args.fileName, args.mimeType, args.bytes),
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'elite_bank_statement_extraction',
          schema: extractionSchema,
          strict: true,
        },
      },
      max_output_tokens: 1800,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI bank statement extraction failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const outputText = extractOutputText(await response.json());
  if (!outputText) throw new Error('OpenAI bank statement extraction returned no JSON.');
  return normalizeExtraction(JSON.parse(outputText), 'openai');
}

function fallbackExtraction(fileName: string): BankStatementExtraction {
  return {
    document_type: 'bank_statement',
    provider: 'rules',
    confidence: 'low',
    bank_name: '',
    account_holder_name: '',
    account_last4: '',
    statement_period_start: '',
    statement_period_end: '',
    total_deposits: '',
    deposit_count: '',
    total_withdrawals: '',
    beginning_balance: '',
    ending_balance: '',
    average_daily_balance: '',
    lowest_daily_balance: '',
    negative_days: '',
    nsf_count: '',
    overdraft_count: '',
    revenue_trend: 'unknown',
    notes: [`${fileName} was classified as a bank statement. AI extraction was unavailable, so staff should review deposits, NSFs, negative days, and balances manually.`],
    missing_fields: ['bank_name', 'statement_period', 'total_deposits', 'negative_days', 'nsf_count', 'ending_balance'],
  };
}

export async function extractBankStatementSignals(args: { fileName: string; mimeType?: string | null; bytes: Buffer }) {
  try {
    const azureExtraction = await generateAzureExtraction(args);
    if (azureExtraction) return azureExtraction;
  } catch (error) {
    if (!ALLOW_OPENAI_FALLBACK && AI_PROVIDER !== 'openai') return { ...fallbackExtraction(args.fileName), error: error instanceof Error ? error.message : 'Azure extraction failed.' };
  }

  if (AI_PROVIDER === 'openai' || ALLOW_OPENAI_FALLBACK) {
    try {
      const openAiExtraction = await generateOpenAiExtraction(args);
      if (openAiExtraction) return openAiExtraction;
    } catch (error) {
      return { ...fallbackExtraction(args.fileName), error: error instanceof Error ? error.message : 'OpenAI extraction failed.' };
    }
  }

  return fallbackExtraction(args.fileName);
}
