import { PDFDocument } from 'pdf-lib';
import { buildPartnerApplicationPayload, parsePartnerApplicationCsv, type PartnerApplicationPayload } from './partner-application-fields';

type RecordMap = Record<string, any>;

const AI_PROVIDER = (process.env.AI_PROVIDER || 'azure').toLowerCase();
const ALLOW_OPENAI_FALLBACK = process.env.ALLOW_OPENAI_FALLBACK === 'true';
const AI_MAX_BYTES = 10 * 1024 * 1024;

const ownerExtractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zip: { type: 'string' },
    phone: { type: 'string' },
    mobile: { type: 'string' },
    email: { type: 'string' },
    ownership_percentage: { type: 'string' },
    dob: { type: 'string' },
    ssn: { type: 'string' },
  },
  required: ['first_name', 'last_name', 'address', 'city', 'state', 'zip', 'phone', 'mobile', 'email', 'ownership_percentage', 'dob', 'ssn'],
};

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    company_name: { type: 'string' },
    legal_name: { type: 'string' },
    dba: { type: 'string' },
    business_address: { type: 'string' },
    address: { type: 'string' },
    city: { type: 'string' },
    state: { type: 'string' },
    zip: { type: 'string' },
    business_phone: { type: 'string' },
    business_email: { type: 'string' },
    ein: { type: 'string' },
    start_date: { type: 'string' },
    requested_amount: { type: 'string' },
    products_services: { type: 'string' },
    industry: { type: 'string' },
    signature: { type: 'string' },
    signature_date: { type: 'string' },
    owner1: ownerExtractionSchema,
    owner2: ownerExtractionSchema,
    existing_advances: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          funder_name: { type: 'string' },
          original_amount: { type: 'string' },
          current_balance: { type: 'string' },
          daily_payment: { type: 'string' },
          payment_frequency: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['funder_name', 'original_amount', 'current_balance', 'daily_payment', 'payment_frequency', 'notes'],
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    missing_fields: { type: 'array', items: { type: 'string' } },
    extraction_notes: { type: 'string' },
  },
  required: ['company_name', 'legal_name', 'dba', 'business_address', 'address', 'city', 'state', 'zip', 'business_phone', 'business_email', 'ein', 'start_date', 'requested_amount', 'products_services', 'industry', 'signature', 'signature_date', 'owner1', 'owner2', 'existing_advances', 'confidence', 'missing_fields', 'extraction_notes'],
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function splitOwnerName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

function cleanPayload(input: RecordMap = {}) {
  const payload = buildPartnerApplicationPayload(input);
  const owner2 = payload.owner2 || {};
  return {
    company_name: text(payload.company_name),
    legal_name: text(payload.legal_name),
    dba: text(payload.dba),
    business_address: text(payload.business_address),
    address: text(payload.address),
    city: text(payload.city),
    state: text(payload.state).toUpperCase(),
    zip: text(payload.zip),
    business_phone: text(payload.business_phone),
    business_email: text(payload.business_email),
    ein: text(payload.ein),
    start_date: text(payload.start_date),
    requested_amount: text(payload.requested_amount),
    products_services: text(payload.products_services),
    industry: text(payload.industry),
    signature: text(payload.signature),
    signature_date: text(payload.signature_date),
    owner1: {
      first_name: text(payload.owner1?.first_name),
      last_name: text(payload.owner1?.last_name),
      address: text(payload.owner1?.address),
      city: text(payload.owner1?.city),
      state: text(payload.owner1?.state).toUpperCase(),
      zip: text(payload.owner1?.zip),
      phone: text(payload.owner1?.phone),
      mobile: text(payload.owner1?.mobile),
      email: text(payload.owner1?.email),
      ownership_percentage: text(payload.owner1?.ownership_percentage),
      dob: text(payload.owner1?.dob),
      ssn: text(payload.owner1?.ssn),
    },
    owner2: {
      first_name: text(owner2.first_name),
      last_name: text(owner2.last_name),
      address: text(owner2.address),
      city: text(owner2.city),
      state: text(owner2.state).toUpperCase(),
      zip: text(owner2.zip),
      phone: text(owner2.phone),
      mobile: text(owner2.mobile),
      email: text(owner2.email),
      ownership_percentage: text(owner2.ownership_percentage),
      dob: text(owner2.dob),
      ssn: text(owner2.ssn),
    },
    has_existing_advances: Boolean(payload.has_existing_advances),
    existing_advances: Array.isArray(payload.existing_advances) ? payload.existing_advances.slice(0, 3).map((advance: RecordMap) => ({
      funder_name: text(advance.funder_name),
      original_amount: text(advance.original_amount),
      current_balance: text(advance.current_balance),
      daily_payment: text(advance.daily_payment),
      payment_frequency: text(advance.payment_frequency),
      notes: text(advance.notes),
    })) : [],
  };
}

function mergeNonEmpty(base: RecordMap, override: RecordMap): RecordMap {
  const next = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    if ((key === 'owner1' || key === 'owner2') && typeof value === 'object' && value) {
      next[key] = mergeNonEmpty(next[key] || {}, value as RecordMap);
      return;
    }
    if (Array.isArray(value)) {
      if (value.length) next[key] = value;
      return;
    }
    if (text(value)) next[key] = value;
  });
  return next;
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
  if (type.startsWith('image/')) {
    return { type: 'input_image', image_url: dataUrl };
  }
  return { type: 'input_file', filename: fileName, file_data: dataUrl };
}

function buildAiPrompt(fallback: PartnerApplicationPayload) {
  return [
    'Extract the merchant cash advance application fields from this partner application.',
    'Return only JSON that matches the schema.',
    'Use exact values from the document. Do not invent missing values.',
    'Important fields: DOB/date of birth, SSN/social security number, tax ID/EIN/FEIN, percent ownership/ownership %, business city/state/ZIP, owner city/state/ZIP, signer name, signature date.',
    'Extract co-owner/owner 2 fields when present. If no co-owner appears, return empty strings for owner2.',
    'Extract up to three open advances/current positions with funder name and remaining/current balance when present.',
    'If a combined address line includes city/state/ZIP, split it into address, city, state, and zip.',
    'Normalize state values to two-letter US postal abbreviations only when the document clearly provides the state.',
    'Use the word funder only in notes if needed.',
    `Known CRM fallback context, to use only when the file does not show a value: ${JSON.stringify(cleanPayload(fallback))}`,
  ].join('\n');
}

function normalizeAiPayload(value: RecordMap) {
  const payload = cleanPayload(value);
  return {
    ...payload,
    ai_confidence: ['low', 'medium', 'high'].includes(value?.confidence) ? value.confidence : 'medium',
    ai_missing_fields: Array.isArray(value?.missing_fields) ? value.missing_fields.map(text).filter(Boolean).slice(0, 20) : [],
    ai_extraction_notes: text(value?.extraction_notes),
  };
}

async function generateAzureResponsesExtraction({ fileName, mimeType, bytes, fallback }: { fileName: string; mimeType?: string | null; bytes: Buffer; fallback: PartnerApplicationPayload }) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const responsesUrl = process.env.AZURE_OPENAI_RESPONSES_URL;
  if (!apiKey || !responsesUrl || bytes.length > AI_MAX_BYTES) return null;

  const response = await fetch(responsesUrl, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.AZURE_OPENAI_MODEL || 'gpt-4.1-mini',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: buildAiPrompt(fallback) },
          fileContentPart(fileName, mimeType, bytes),
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'elite_partner_application_extraction',
          schema: extractionSchema,
          strict: true,
        },
      },
      max_output_tokens: 3200,
    }),
  });

  if (!response.ok) throw new Error(`Azure AI extraction failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const data = await response.json();
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error('Azure AI extraction returned no JSON.');
  return normalizeAiPayload(JSON.parse(outputText));
}

async function generateOpenAiExtraction({ fileName, mimeType, bytes, fallback }: { fileName: string; mimeType?: string | null; bytes: Buffer; fallback: PartnerApplicationPayload }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || bytes.length > AI_MAX_BYTES) return null;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: buildAiPrompt(fallback) },
          fileContentPart(fileName, mimeType, bytes),
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'elite_partner_application_extraction',
          schema: extractionSchema,
          strict: true,
        },
      },
      max_output_tokens: 3200,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI extraction failed (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const data = await response.json();
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error('OpenAI extraction returned no JSON.');
  return normalizeAiPayload(JSON.parse(outputText));
}

async function extractAiPayload(args: { fileName: string; mimeType?: string | null; bytes: Buffer; fallback: PartnerApplicationPayload }) {
  try {
    const azurePayload = await generateAzureResponsesExtraction(args);
    if (azurePayload) return { provider: 'azure-openai', payload: azurePayload };
  } catch (error) {
    if (!ALLOW_OPENAI_FALLBACK && AI_PROVIDER !== 'openai') return { provider: 'rules', payload: {}, error: error instanceof Error ? error.message : 'Azure AI extraction failed.' };
  }

  if (AI_PROVIDER === 'openai' || ALLOW_OPENAI_FALLBACK) {
    try {
      const openAiPayload = await generateOpenAiExtraction(args);
      if (openAiPayload) return { provider: 'openai', payload: openAiPayload };
    } catch (error) {
      return { provider: 'rules', payload: {}, error: error instanceof Error ? error.message : 'OpenAI extraction failed.' };
    }
  }

  return { provider: 'rules', payload: {} };
}

async function extractPdfFormPayload(bytes: Buffer) {
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    const values: Record<string, string> = {};
    form.getFields().forEach((field) => {
      const name = normalizeKey(field.getName());
      const value = text((field as any).getText?.() ?? (field as any).getSelected?.()?.join?.(', ') ?? (field as any).isChecked?.());
      if (value && value !== 'false') values[name] = value;
    });
    if (!Object.keys(values).length) return {};
    const ownerName = text(values.owner_name || values.principal_name || values.applicant_name || values.authorized_signer);
    const owner2Name = text(values.owner2_name || values.co_owner_name || values.second_owner_name || values.principal_2_name);
    const ownerParts = splitOwnerName(ownerName);
    const owner2Parts = splitOwnerName(owner2Name);
    return buildPartnerApplicationPayload({
      company_name: values.company_name || values.business_name || values.legal_business_name || values.merchant_name,
      legal_name: values.legal_name || values.legal_business_name || values.business_name || values.company_name || values.merchant_name,
      dba: values.dba || values.doing_business_as,
      business_address: values.business_address || values.company_address || values.physical_address || values.address,
      city: values.business_city || values.city,
      state: values.business_state || values.state,
      zip: values.business_zip || values.company_zip || values.zip || values.zip_code || values.postal_code,
      business_phone: values.business_phone || values.company_phone || values.phone,
      business_email: values.business_email || values.company_email || values.email,
      ein: values.ein || values.tax_id || values.federal_tax_id,
      start_date: values.business_start_date || values.start_date || values.date_business_started,
      requested_amount: values.requested_amount || values.amount_requested || values.funding_amount,
      products_services: values.products_services || values.industry || values.business_type,
      signature: values.signature || values.applicant_signature || values.signed_name || ownerName,
      signature_date: values.signature_date || values.signed_date || values.date_signed || values.application_date,
      owner1: {
        first_name: values.owner_first_name || ownerParts.first_name,
        last_name: values.owner_last_name || ownerParts.last_name,
        address: values.owner_address || values.home_address,
        city: values.owner_city || values.home_city,
        state: values.owner_state || values.home_state,
        zip: values.owner_zip || values.home_zip,
        phone: values.owner_phone || values.cell_phone || values.mobile_phone,
        email: values.owner_email || values.applicant_email || values.email,
        ownership_percentage: values.ownership_percentage || values.ownership_percent || values.percent_ownership || values.percent_of_ownership || values.ownership,
        dob: values.dob || values.date_of_birth || values.owner_dob || values.owner_date_of_birth,
        ssn: values.ssn || values.social_security_number || values.owner_ssn,
      },
      owner2: {
        first_name: values.owner2_first_name || values.co_owner_first_name || owner2Parts.first_name,
        last_name: values.owner2_last_name || values.co_owner_last_name || owner2Parts.last_name,
        address: values.owner2_address || values.co_owner_address || values.co_owner_home_address,
        city: values.owner2_city || values.co_owner_city,
        state: values.owner2_state || values.co_owner_state,
        zip: values.owner2_zip || values.co_owner_zip,
        phone: values.owner2_phone || values.co_owner_phone || values.co_owner_cell_phone,
        email: values.owner2_email || values.co_owner_email,
        ownership_percentage: values.owner2_ownership_percentage || values.owner2_percent_ownership || values.co_owner_ownership_percentage || values.co_owner_percent_ownership,
        dob: values.owner2_dob || values.owner2_date_of_birth || values.co_owner_dob || values.co_owner_date_of_birth,
        ssn: values.owner2_ssn || values.co_owner_ssn,
      },
      existing_advance_funder: values.existing_advance_funder || values.open_advance_funder || values.current_funder || values.advance_1_funder,
      existing_advance_balance: values.existing_advance_balance || values.open_advance_balance || values.current_balance || values.advance_1_balance,
      existing_advance_2_funder: values.existing_advance_2_funder || values.open_advance_2_funder || values.current_funder_2 || values.advance_2_funder,
      existing_advance_2_balance: values.existing_advance_2_balance || values.open_advance_2_balance || values.current_balance_2 || values.advance_2_balance,
      existing_advance_3_funder: values.existing_advance_3_funder || values.open_advance_3_funder || values.current_funder_3 || values.advance_3_funder,
      existing_advance_3_balance: values.existing_advance_3_balance || values.open_advance_3_balance || values.current_balance_3 || values.advance_3_balance,
    });
  } catch {
    return {};
  }
}

export async function extractPartnerApplicationPayloadFromUpload({
  fileName,
  mimeType,
  bytes,
  fallback,
}: {
  fileName: string;
  mimeType?: string | null;
  bytes: Buffer;
  fallback: PartnerApplicationPayload;
}) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (extension === 'csv' || mimeType === 'text/csv' || mimeType === 'application/csv') {
    return buildPartnerApplicationPayload({
      ...parsePartnerApplicationCsv(bytes.toString('utf8')),
      extraction_provider: 'csv',
      extraction_note: 'CSV uploaded and mapped from the first data row. Review/edit fields before sending if the partner file has multiple merchants or unusual headers.',
    });
  }

  if (extension === 'pdf' || mimeType === 'application/pdf') {
    const formPayload = await extractPdfFormPayload(bytes);
    const ai = await extractAiPayload({ fileName, mimeType, bytes, fallback });
    const extracted = buildPartnerApplicationPayload(mergeNonEmpty(mergeNonEmpty(fallback, formPayload), ai.payload));
    return buildPartnerApplicationPayload({
      ...extracted,
      signature_data_url: (extracted as any).signature_data_url || (fallback as any).signature_data_url || '',
      extraction_provider: ai.provider === 'rules' && Object.keys(formPayload).length ? 'pdf_form' : ai.provider,
      extraction_note: ai.provider !== 'rules'
        ? `AI extracted fields from the uploaded PDF. Confidence: ${(ai.payload as any).ai_confidence || 'medium'}. Review any blank or low-confidence fields before sending to funders.`
        : ai.error
          ? `AI extraction was unavailable (${ai.error}). PDF converted from form fields/current CRM values. Review/edit fields before sending.`
          : Object.keys(formPayload).length
            ? 'PDF form fields were extracted automatically. Review/edit fields before sending if the original partner form had unusual formatting.'
            : 'PDF uploaded and converted from current CRM fields. Review/edit fields if the partner file has newer details.',
    });
  }

  if ((mimeType || '').startsWith('image/')) {
    const ai = await extractAiPayload({ fileName, mimeType, bytes, fallback });
    const extracted = buildPartnerApplicationPayload(mergeNonEmpty(fallback, ai.payload));
    return buildPartnerApplicationPayload({
      ...extracted,
      signature_data_url: (extracted as any).signature_data_url || (fallback as any).signature_data_url || '',
      extraction_provider: ai.provider,
      extraction_note: ai.provider !== 'rules'
        ? `AI extracted fields from the uploaded image. Confidence: ${(ai.payload as any).ai_confidence || 'medium'}. Review any blank or low-confidence fields before sending to funders.`
        : ai.error
          ? `AI extraction was unavailable (${ai.error}). Image stored and Elite PDF generated from current CRM values. Review/edit fields before sending.`
          : 'Image uploaded and Elite PDF generated from current CRM fields. Review/edit fields if the partner file has newer details.',
    });
  }

  return buildPartnerApplicationPayload({
    ...fallback,
    extraction_provider: 'rules',
    extraction_note: 'Elite PDF generated from current CRM fields. Review/edit fields if the partner file has newer data.',
  });
}
