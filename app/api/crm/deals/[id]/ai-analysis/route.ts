import { NextResponse } from 'next/server';
import { requireCrmProfile } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const AI_ROLES = ['super_admin', 'admin', 'manager', 'sales_rep', 'processor', 'underwriter'];

type RecordMap = Record<string, any>;
type AiProvider = 'azure-openai' | 'openai' | 'rules';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'azure').toLowerCase();
const ALLOW_OPENAI_FALLBACK = process.env.ALLOW_OPENAI_FALLBACK === 'true';

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'fundingReadiness',
    'riskFlags',
    'missingItems',
    'recommendedNextActions',
    'funderEmailDraft',
    'questionsForMerchant',
    'confidence',
  ],
  properties: {
    summary: { type: 'string' },
    fundingReadiness: { type: 'string' },
    riskFlags: { type: 'array', items: { type: 'string' } },
    missingItems: { type: 'array', items: { type: 'string' } },
    recommendedNextActions: { type: 'array', items: { type: 'string' } },
    funderEmailDraft: {
      type: 'object',
      additionalProperties: false,
      required: ['subject', 'body'],
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
      },
    },
    questionsForMerchant: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

function redactSensitiveFields(value: any): any {
  if (Array.isArray(value)) return value.map(redactSensitiveFields);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const normalized = key.toLowerCase();
      if (
        normalized.includes('ssn') ||
        normalized.includes('ein') ||
        normalized.includes('tax_id') ||
        normalized.includes('password') ||
        normalized.includes('token') ||
        normalized.includes('secret') ||
        normalized.includes('signature')
      ) {
        return [key, entry ? '[redacted]' : entry];
      }
      return [key, redactSensitiveFields(entry)];
    })
  );
}

function compactRows(rows: RecordMap[] | null | undefined, limit = 12) {
  return redactSensitiveFields((rows || []).slice(0, limit));
}

function fallbackAnalysis(context: RecordMap) {
  const documents = context.documents || [];
  const notes = context.notes || [];
  const riskEvents = context.riskEvents || [];
  const submissions = context.submissions || [];
  const application = context.application || {};
  const business = context.business || {};
  const deal = context.deal || {};
  const missingItems = [
    documents.some((document: RecordMap) => /application/i.test(String(document.document_type || document.label || document.file_name || '')))
      ? ''
      : 'Completed signed application',
    documents.some((document: RecordMap) => /bank/i.test(String(document.document_type || document.label || document.file_name || '')))
      ? ''
      : 'Recent business bank statements',
    application.signature_status === 'signed' ? '' : 'Confirmed borrower signature',
  ].filter(Boolean);
  const riskFlags = [
    ...riskEvents.slice(0, 4).map((event: RecordMap) => event.title || event.event_type || event.risk_type || event.notes || 'Risk event recorded'),
    Number(application.nsf_count || 0) > 0 ? `${application.nsf_count} NSF item(s) recorded` : '',
    Number(application.negative_days_count || 0) > 0 ? `${application.negative_days_count} negative day(s) recorded` : '',
  ].filter(Boolean);

  return {
    summary: `${business.legal_name || business.name || deal.title || 'This deal'} is requesting ${deal.requested_amount ? `$${Number(deal.requested_amount).toLocaleString()}` : 'funding'} and is currently in ${String(deal.stage_slug || 'the active pipeline').replaceAll('_', ' ')}.`,
    fundingReadiness: missingItems.length
      ? 'Not ready for broad funder submission until the missing package items are resolved.'
      : submissions.length
        ? 'Package appears ready based on CRM records, with prior funder submissions already logged.'
        : 'Package appears close to ready based on CRM records. Staff should do a final file review before sending.',
    riskFlags: riskFlags.length ? riskFlags : ['No major risk flags are recorded in the CRM fields reviewed.'],
    missingItems,
    recommendedNextActions: missingItems.length
      ? [`Collect ${missingItems[0].toLowerCase()}.`, 'Verify file completeness before sending to funders.', 'Update CRM notes after merchant follow-up.']
      : ['Select the best-fit funders for this file.', 'Send the application package from the connected Gmail account.', 'Log funder responses and compare offers.'],
    funderEmailDraft: {
      subject: `${business.legal_name || business.name || 'Merchant'} - funding package`,
      body: `Hi,\n\nPlease review the attached funding package for ${business.legal_name || business.name || 'this merchant'}.\n\nRequested amount: ${deal.requested_amount ? `$${Number(deal.requested_amount).toLocaleString()}` : 'See application'}\nMonthly revenue: ${business.monthly_gross_revenue ? `$${Number(business.monthly_gross_revenue).toLocaleString()}` : 'See file'}\n\nPlease let us know if you need any additional stips.\n\nThank you,`,
    },
    questionsForMerchant: missingItems.length ? missingItems.map((item: string) => `Can you provide the ${item.toLowerCase()}?`) : [],
    confidence: context.aiConfigured ? 'medium' : 'low',
  };
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeAnalysis(value: RecordMap) {
  return {
    summary: String(value?.summary || 'AI analysis did not return a summary.'),
    fundingReadiness: String(value?.fundingReadiness || 'Review the CRM file before funder submission.'),
    riskFlags: stringList(value?.riskFlags),
    missingItems: stringList(value?.missingItems),
    recommendedNextActions: stringList(value?.recommendedNextActions),
    funderEmailDraft: {
      subject: String(value?.funderEmailDraft?.subject || 'Funding package for review'),
      body: String(value?.funderEmailDraft?.body || 'Hi,\n\nPlease review the attached funding package.\n\nThank you,'),
    },
    questionsForMerchant: stringList(value?.questionsForMerchant),
    confidence: ['low', 'medium', 'high'].includes(value?.confidence) ? value.confidence : 'medium',
  };
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

function buildAiMessages(context: RecordMap) {
  return [
    {
      role: 'system',
      content: [
        'You are an internal CRM funding package assistant for Elite Funding Solutions.',
        'Use only the CRM context provided.',
        'Do not make credit, underwriting, legal, or approval decisions.',
        'Use the word funder, not lender.',
        'Keep recommendations operational, concise, and ready for staff review.',
        'Return only valid JSON matching the requested schema.',
        `JSON schema: ${JSON.stringify(analysisSchema)}`,
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify(redactSensitiveFields(context)),
    },
  ];
}

async function generateOpenAiAnalysis(context: RecordMap) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const messages = buildAiMessages(context);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: messages.map((message) => ({
        role: message.role,
        content: [{ type: 'input_text', text: message.content }],
      })),
      text: {
        format: {
          type: 'json_schema',
          name: 'elite_crm_deal_analysis',
          schema: analysisSchema,
          strict: true,
        },
      },
      max_output_tokens: 1800,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`AI provider error (${response.status}): ${detail.slice(0, 240)}`);
  }

  const data = await response.json();
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error('AI provider returned an empty analysis.');
  return normalizeAnalysis(JSON.parse(outputText));
}

async function generateAzureOpenAiAnalysis(context: RecordMap) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const completionsUrl = process.env.AZURE_OPENAI_CHAT_COMPLETIONS_URL;
  if (!apiKey || !completionsUrl) return null;

  const response = await fetch(completionsUrl, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: buildAiMessages(context),
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1800,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Azure AI provider error (${response.status}): ${detail.slice(0, 240)}`);
  }

  const data = await response.json();
  const outputText = data.choices?.[0]?.message?.content;
  if (!outputText) throw new Error('Azure AI provider returned an empty analysis.');
  return normalizeAnalysis(JSON.parse(outputText));
}

async function generateAzureOpenAiResponsesAnalysis(context: RecordMap) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const responsesUrl = process.env.AZURE_OPENAI_RESPONSES_URL;
  if (!apiKey || !responsesUrl) return null;

  const messages = buildAiMessages(context);
  const response = await fetch(responsesUrl, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.AZURE_OPENAI_MODEL || 'gpt-4.1-mini',
      input: messages.map((message) => ({
        role: message.role,
        content: [{ type: 'input_text', text: message.content }],
      })),
      text: {
        format: {
          type: 'json_schema',
          name: 'elite_crm_deal_analysis',
          schema: analysisSchema,
          strict: true,
        },
      },
      max_output_tokens: 1800,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Azure Responses provider error (${response.status}): ${detail.slice(0, 240)}`);
  }

  const data = await response.json();
  const outputText = extractOutputText(data);
  if (!outputText) throw new Error('Azure Responses provider returned an empty analysis.');
  return normalizeAnalysis(JSON.parse(outputText));
}

async function generateAiAnalysis(context: RecordMap): Promise<{ provider: AiProvider; analysis: ReturnType<typeof normalizeAnalysis> } | null> {
  const azureAnalysis = await generateAzureOpenAiResponsesAnalysis(context) || await generateAzureOpenAiAnalysis(context);
  if (azureAnalysis) return { provider: 'azure-openai', analysis: azureAnalysis };

  if (AI_PROVIDER === 'openai' || ALLOW_OPENAI_FALLBACK) {
    const openAiAnalysis = await generateOpenAiAnalysis(context);
    if (openAiAnalysis) return { provider: 'openai', analysis: openAiAnalysis };
  }

  return null;
}

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCrmProfile(AI_ROLES);
  if ('response' in auth) return auth.response;
  const { profile, supabase } = auth;

  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!deal) {
    return NextResponse.json({ success: false, error: 'Deal not found.' }, { status: 404 });
  }

  const [businessResult, applicationResult, documentsResult, notesResult, riskEventsResult, submissionsResult, offersResult, positionsResult] = await Promise.all([
    deal.business_id
      ? supabase.from('businesses').select('*').eq('id', deal.business_id).eq('organization_id', profile.organization_id).maybeSingle()
      : Promise.resolve({ data: null }),
    deal.application_id
      ? supabase.from('applications').select('*').eq('id', deal.application_id).eq('organization_id', profile.organization_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('documents').select('id,label,file_name,document_type,status,created_at').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(25),
    supabase.from('notes').select('id,title,body,note,content,created_at').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('deal_risk_events').select('*').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('partner_submissions').select('*').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(15),
    supabase.from('offers').select('*').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('current_positions').select('*').eq('organization_id', profile.organization_id).eq('deal_id', deal.id).limit(10),
  ]);

  const context = {
    aiConfigured: Boolean(
      process.env.AZURE_OPENAI_API_KEY && (process.env.AZURE_OPENAI_RESPONSES_URL || process.env.AZURE_OPENAI_CHAT_COMPLETIONS_URL)
    ),
    aiProvider: 'azure-openai',
    deal: redactSensitiveFields(deal),
    business: redactSensitiveFields((businessResult as any).data || null),
    application: redactSensitiveFields((applicationResult as any).data || null),
    documents: compactRows((documentsResult as any).data),
    notes: compactRows((notesResult as any).data),
    riskEvents: compactRows((riskEventsResult as any).data),
    submissions: compactRows((submissionsResult as any).data),
    offers: compactRows((offersResult as any).data),
    currentPositions: compactRows((positionsResult as any).data),
  };

  try {
    const generated = await generateAiAnalysis(context);
    return NextResponse.json({
      success: true,
      provider: generated?.provider || 'rules',
      configured: Boolean(generated),
      analysis: generated?.analysis || fallbackAnalysis(context),
    });
  } catch (error) {
    console.error('[crm-ai] AI analysis failed:', error);
    return NextResponse.json({
      success: true,
      provider: 'rules',
      configured: false,
      warning: error instanceof Error ? error.message : 'AI provider failed. Returned rules-based fallback.',
      analysis: fallbackAnalysis(context),
    });
  }
}
