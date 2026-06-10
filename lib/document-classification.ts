type RecordMap = Record<string, any>;

const AI_PROVIDER = (process.env.AI_PROVIDER || 'azure').toLowerCase();
const ALLOW_OPENAI_FALLBACK = process.env.ALLOW_OPENAI_FALLBACK === 'true';
const AI_MAX_BYTES = 10 * 1024 * 1024;

export const CRM_DOCUMENT_TYPES = [
  'bank_statement',
  'bank_statements',
  'drivers_license',
  'license_verification',
  'voided_check',
  'bank_letter',
  'tax_return',
  'processing_statement',
  'financial_statement',
  'business_verification',
  'advance_statements',
  'invoice',
  'signed_contract',
  'final_bank_verification',
  'final_owner_id_verification',
  'payoff_letter',
  'stipulation',
  'signed_application',
  'completed_application',
  'partner_application',
  'other',
] as const;

export type CrmDocumentType = typeof CRM_DOCUMENT_TYPES[number];

export type DocumentClassification = {
  document_type: CrmDocumentType;
  label: string;
  confidence: 'low' | 'medium' | 'high';
  provider: 'azure-openai' | 'openai' | 'rules';
  reasoning?: string;
  matched_request_id?: string | null;
  error?: string;
};

const labelByType: Record<CrmDocumentType, string> = {
  bank_statement: 'Bank Statement',
  bank_statements: 'Bank Statements',
  drivers_license: "Driver's License",
  license_verification: 'License Verification',
  voided_check: 'Voided Check',
  bank_letter: 'Bank Letter',
  tax_return: 'Tax Return',
  processing_statement: 'Processing Statement',
  financial_statement: 'Financial Statement',
  business_verification: 'Business Verification',
  advance_statements: 'Advance Statements',
  invoice: 'Invoice',
  signed_contract: 'Signed Contract',
  final_bank_verification: 'Final Bank Verification',
  final_owner_id_verification: 'Final Owner ID Verification',
  payoff_letter: 'Payoff Letter',
  stipulation: 'Stipulation',
  signed_application: 'Signed Application',
  completed_application: 'Completed Application',
  partner_application: 'Partner Application',
  other: 'Other',
};

const classificationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    document_type: { type: 'string', enum: CRM_DOCUMENT_TYPES },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reasoning: { type: 'string' },
  },
  required: ['document_type', 'confidence', 'reasoning'],
};

function normalize(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function sameCrmDocumentType(value: unknown, wanted: unknown) {
  const rawValue = text(value);
  const rawWanted = text(wanted);
  const a = normalize(rawValue).replace(/s$/, '');
  const b = normalize(rawWanted).replace(/s$/, '');
  return a === b
    || (['license_verification', 'owner_id_verification', 'drivers_license', 'driver_license'].includes(rawWanted) && ['drivers_license', 'driver_license', 'license_verification', 'owner_id_verification', 'final_owner_id_verification'].includes(rawValue))
    || (['licenseverification', 'owneridverification', 'driverslicense', 'driverlicense', 'finalowneridverification'].includes(b) && ['driverslicense', 'driverlicense', 'licenseverification', 'owneridverification', 'finalowneridverification'].includes(a))
    || (['completed_application', 'signed_application', 'application'].includes(rawWanted) && ['completed_application', 'signed_application', 'application'].includes(rawValue))
    || (['completedapplication', 'signedapplication', 'application'].includes(b) && ['completedapplication', 'signedapplication', 'application'].includes(a))
    || (['bank_statement', 'bank_statements'].includes(rawWanted) && ['bank_statement', 'bank_statements'].includes(rawValue))
    || (['bankstatement', 'bankstatements'].includes(b) && ['bankstatement', 'bankstatements'].includes(a));
}

function knownType(value: unknown): CrmDocumentType | null {
  const normalized = normalize(value);
  return CRM_DOCUMENT_TYPES.find((type) => normalize(type) === normalized || sameCrmDocumentType(type, value)) || null;
}

function labelForType(type: CrmDocumentType) {
  return labelByType[type] || type.replaceAll('_', ' ');
}

function fallbackClassify(fileName: string, requestContext = ''): DocumentClassification {
  const haystack = `${fileName} ${requestContext}`.toLowerCase();
  const checks: Array<[RegExp, CrmDocumentType]> = [
    [/\b(voided|cancelled|canceled)\s*check\b|\bcheck\b/, 'voided_check'],
    [/\bbank\s*letter\b/, 'bank_letter'],
    [/\b(bank|statement|statements|mtd)\b/, 'bank_statements'],
    [/\b(driver|drivers|license|licence|owner\s*id|photo\s*id|passport)\b/, 'drivers_license'],
    [/\b(tax|return|1040|1120|1065|schedule\s*c)\b/, 'tax_return'],
    [/\b(processing|processor|merchant\s*statement|merchant\s*processing)\b/, 'processing_statement'],
    [/\b(financial|p\s*&\s*l|profit|loss|balance\s*sheet)\b/, 'financial_statement'],
    [/\b(invoice|equipment\s*quote|quote)\b/, 'invoice'],
    [/\b(payoff|pay\s*off)\b/, 'payoff_letter'],
    [/\b(advance|position|funding\s*statement|balance)\b/, 'advance_statements'],
    [/\b(contract|agreement)\b/, 'signed_contract'],
    [/\b(bank\s*verification|plaid|routing|account)\b/, 'final_bank_verification'],
    [/\b(business\s*verification|ownership|articles|certificate|lease|utility)\b/, 'business_verification'],
    [/\b(stip|stipulation|condition)\b/, 'stipulation'],
    [/\b(application|app)\b/, 'signed_application'],
  ];
  const type = checks.find(([pattern]) => pattern.test(haystack))?.[1] || 'other';
  return { document_type: type, label: labelForType(type), confidence: type === 'other' ? 'low' : 'medium', provider: 'rules', reasoning: type === 'other' ? 'No strong document signal found.' : 'Matched filename or request wording.' };
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

function buildPrompt({ fileName, requests, funderRequirements }: { fileName: string; requests: RecordMap[]; funderRequirements: string[] }) {
  const requestContext = requests.map((request) => ({
    id: request.id,
    document_type: request.document_type,
    label: request.label,
    category: request.category,
    notes: request.notes || request.description,
    status: request.status,
  }));
  return [
    'Classify this CRM deal document for a merchant cash advance funding package.',
    'Return only JSON that matches the schema. Choose exactly one document_type from the allowed enum.',
    'Do not invent a new document type. If the file is unclear, use other with low confidence.',
    'Prefer the document category that would satisfy an open requested item or funder requirement when the file content supports it.',
    'Examples: bank statements, driver license/owner ID, voided check, tax return, processing statement, invoice, payoff letter, signed contract, business verification, advance statement.',
    `Filename: ${fileName}`,
    `Open CRM document requests: ${JSON.stringify(requestContext).slice(0, 4000)}`,
    `Known funder-required document types: ${JSON.stringify(funderRequirements).slice(0, 1000)}`,
  ].join('\n');
}

function normalizeAiClassification(value: RecordMap, provider: 'azure-openai' | 'openai'): DocumentClassification {
  const type = knownType(value?.document_type) || 'other';
  const confidence = ['low', 'medium', 'high'].includes(value?.confidence) ? value.confidence : 'medium';
  return {
    document_type: type,
    label: labelForType(type),
    confidence,
    provider,
    reasoning: text(value?.reasoning),
  };
}

async function generateAzureClassification(args: { fileName: string; mimeType?: string | null; bytes: Buffer; requests: RecordMap[]; funderRequirements: string[] }) {
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
          { type: 'input_text', text: buildPrompt(args) },
          fileContentPart(args.fileName, args.mimeType, args.bytes),
        ],
      }],
      text: { format: { type: 'json_schema', name: 'elite_document_classification', schema: classificationSchema, strict: true } },
      max_output_tokens: 600,
    }),
  });
  if (!response.ok) throw new Error(`Azure document classification failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const data = await response.json();
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error('Azure document classification returned no JSON.');
  return normalizeAiClassification(JSON.parse(outputText), 'azure-openai');
}

async function generateOpenAiClassification(args: { fileName: string; mimeType?: string | null; bytes: Buffer; requests: RecordMap[]; funderRequirements: string[] }) {
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
          { type: 'input_text', text: buildPrompt(args) },
          fileContentPart(args.fileName, args.mimeType, args.bytes),
        ],
      }],
      text: { format: { type: 'json_schema', name: 'elite_document_classification', schema: classificationSchema, strict: true } },
      max_output_tokens: 600,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI document classification failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const data = await response.json();
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error('OpenAI document classification returned no JSON.');
  return normalizeAiClassification(JSON.parse(outputText), 'openai');
}

function matchRequest(classification: DocumentClassification, requests: RecordMap[]) {
  const openRequests = requests.filter((request) => !['approved', 'waived'].includes(String(request.status || '').toLowerCase()));
  return openRequests.find((request) => sameCrmDocumentType(request.document_type, classification.document_type) || sameCrmDocumentType(classification.document_type, request.document_type)) || null;
}

export async function classifyDealDocumentUpload(args: {
  fileName: string;
  mimeType?: string | null;
  bytes: Buffer;
  requests?: RecordMap[];
  funderRequirements?: string[];
  explicitDocumentType?: string | null;
}) {
  const requests = args.requests || [];
  const explicitType = knownType(args.explicitDocumentType || '');
  const requestContext = requests.map((request) => [request.document_type, request.label, request.notes, request.description].filter(Boolean).join(' ')).join(' ');
  let classification: DocumentClassification | null = explicitType && explicitType !== 'other' ? {
    document_type: explicitType,
    label: labelForType(explicitType),
    confidence: 'high',
    provider: 'rules',
    reasoning: 'Explicit document type was supplied by the caller.',
  } : null;

  if (!classification) {
    try {
      classification = await generateAzureClassification({ ...args, requests, funderRequirements: args.funderRequirements || [] });
    } catch (error) {
      if (!ALLOW_OPENAI_FALLBACK && AI_PROVIDER !== 'openai') {
        classification = { ...fallbackClassify(args.fileName, requestContext), error: error instanceof Error ? error.message : 'Azure document classification failed.' };
      }
    }
  }

  if (!classification && (AI_PROVIDER === 'openai' || ALLOW_OPENAI_FALLBACK)) {
    try {
      classification = await generateOpenAiClassification({ ...args, requests, funderRequirements: args.funderRequirements || [] });
    } catch (error) {
      classification = { ...fallbackClassify(args.fileName, requestContext), error: error instanceof Error ? error.message : 'OpenAI document classification failed.' };
    }
  }

  classification = classification || fallbackClassify(args.fileName, requestContext);
  const matchedRequest = matchRequest(classification, requests);
  return {
    ...classification,
    matched_request_id: matchedRequest?.id || null,
    label: matchedRequest?.label || classification.label,
  };
}
