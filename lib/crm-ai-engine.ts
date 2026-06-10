import { sameCrmDocumentType } from './document-classification';
import {
  hasApplicationSignatureEvidence,
  hasCompleteBusinessLocation,
  hasOwnerDobEvidence,
  hasOwnerOwnershipEvidence,
} from './deal-readiness';

type RecordMap = Record<string, any>;
export type AiProvider = 'azure-openai' | 'openai' | 'rules';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'azure').toLowerCase();
const ALLOW_OPENAI_FALLBACK = process.env.ALLOW_OPENAI_FALLBACK === 'true';

const aiAnalysisSchema = {
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
    'applicationQa',
    'documentIntelligence',
    'funderMatches',
    'packageBuilder',
    'copilot',
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
    applicationQa: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'score', 'blockers', 'warnings', 'verifiedFields', 'fixes'],
      properties: {
        status: { type: 'string', enum: ['ready', 'needs_review', 'blocked'] },
        score: { type: 'number' },
        blockers: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        verifiedFields: { type: 'array', items: { type: 'string' } },
        fixes: { type: 'array', items: { type: 'string' } },
      },
    },
    documentIntelligence: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'documentsReviewed', 'extractedSignals', 'missingDocumentTypes', 'bankStatementAnalysis'],
      properties: {
        status: { type: 'string', enum: ['ready', 'needs_review', 'blocked'] },
        documentsReviewed: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'label', 'documentType', 'confidence', 'signals', 'nextAction'],
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              documentType: { type: 'string' },
              confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
              signals: { type: 'array', items: { type: 'string' } },
              nextAction: { type: 'string' },
            },
          },
        },
        extractedSignals: { type: 'array', items: { type: 'string' } },
        missingDocumentTypes: { type: 'array', items: { type: 'string' } },
        bankStatementAnalysis: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'monthlyRevenue', 'negativeDays', 'nsfCount', 'notes'],
          properties: {
            status: { type: 'string' },
            monthlyRevenue: { type: 'string' },
            negativeDays: { type: 'string' },
            nsfCount: { type: 'string' },
            notes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    funderMatches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fundingPartnerId', 'name', 'score', 'reasons', 'warnings', 'missingRequirements', 'submissionRoute'],
        properties: {
          fundingPartnerId: { type: 'string' },
          name: { type: 'string' },
          score: { type: 'number' },
          reasons: { type: 'array', items: { type: 'string' } },
          warnings: { type: 'array', items: { type: 'string' } },
          missingRequirements: { type: 'array', items: { type: 'string' } },
          submissionRoute: { type: 'string' },
        },
      },
    },
    packageBuilder: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'readyToSend', 'includedDocumentIds', 'requiredDocumentTypes', 'missingDocumentTypes', 'warnings', 'emailSubject', 'emailBody'],
      properties: {
        status: { type: 'string', enum: ['ready', 'needs_review', 'blocked'] },
        readyToSend: { type: 'boolean' },
        includedDocumentIds: { type: 'array', items: { type: 'string' } },
        requiredDocumentTypes: { type: 'array', items: { type: 'string' } },
        missingDocumentTypes: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        emailSubject: { type: 'string' },
        emailBody: { type: 'string' },
      },
    },
    copilot: {
      type: 'object',
      additionalProperties: false,
      required: ['answer', 'suggestedQuestions', 'sourceNotes'],
      properties: {
        answer: { type: 'string' },
        suggestedQuestions: { type: 'array', items: { type: 'string' } },
        sourceNotes: { type: 'array', items: { type: 'string' } },
      },
    },
  },
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function numberValue(value: unknown) {
  const amount = Number(String(value ?? '').replace(/[$,%]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function money(value: unknown) {
  const amount = numberValue(value);
  if (!amount) return '';
  return `$${Math.round(amount).toLocaleString()}`;
}

function normalize(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function list(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean);
}

function redactSensitiveText(value: unknown) {
  return text(value)
    .replace(/\b\d{3}[- ]?\d{2}[- ]?(\d{4})\b/g, '***-**-$1')
    .replace(/\b\d{2}[- ]?\d{3}[- ]?(\d{4})\b/g, '**-***$1');
}

function safeList(value: unknown) {
  return list(value).map(redactSensitiveText).filter(Boolean);
}

function clampScore(value: unknown) {
  const score = Math.round(numberValue(value));
  return Math.max(0, Math.min(100, score));
}

function boolPresent(...values: unknown[]) {
  return values.some((value) => {
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.length > 0;
    return text(value).length > 0;
  });
}

function redactSensitiveFields(value: any): any {
  if (Array.isArray(value)) return value.map(redactSensitiveFields);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const normalized = key.toLowerCase();
    if (
      normalized.includes('ssn') ||
      normalized.includes('ein') ||
      normalized.includes('tax_id') ||
      normalized.includes('password') ||
      normalized.includes('token') ||
      normalized.includes('secret') ||
      normalized.includes('signature_data')
    ) {
      return [key, entry ? '[redacted]' : entry];
    }
    return [key, redactSensitiveFields(entry)];
  }));
}

function compactRows(rows: RecordMap[] | null | undefined, limit = 20) {
  return redactSensitiveFields((rows || []).slice(0, limit));
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(text).filter(Boolean)));
}

function documentLabel(doc: RecordMap) {
  return text(doc.label || doc.file_name || doc.document_type || doc.id || 'Document');
}

function documentIsUsable(doc: RecordMap) {
  return !['rejected', 'needs_replacement', 'expired', 'deleted'].includes(text(doc.status).toLowerCase());
}

function hasDocType(documents: RecordMap[], wanted: string) {
  return documents.some((doc) => documentIsUsable(doc) && sameCrmDocumentType(doc.document_type || doc.application_variant, wanted));
}

function bestDocIdForType(documents: RecordMap[], wanted: string) {
  const doc = documents
    .filter((item) => documentIsUsable(item) && sameCrmDocumentType(item.document_type || item.application_variant, wanted))
    .sort((a, b) => {
      const score = (item: RecordMap) => item.document_type === 'completed_application' ? 4 : item.status === 'approved' ? 3 : item.status === 'uploaded' ? 2 : 1;
      return score(b) - score(a) || new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
    })[0];
  return doc?.id || '';
}

function requiredDocTypesForPartner(partner?: RecordMap | null) {
  const savedRequirements = Array.isArray(partner?.required_documents) ? (partner?.required_documents || []) : [];
  const productTypes = Array.isArray(partner?.product_types) ? (partner?.product_types || []).join(' ').toLowerCase() : text(partner?.product_types).toLowerCase();
  const notes = `${partner?.notes || ''} ${partner?.criteria_notes || ''}`.toLowerCase();
  const required = new Set(['completed_application', 'bank_statements', 'drivers_license', ...savedRequirements.map(text).filter(Boolean)]);
  if (productTypes.includes('mca') || productTypes.includes('merchant') || notes.includes('voided')) required.add('voided_check');
  if (productTypes.includes('equipment') || notes.includes('invoice')) required.add('invoice');
  if (notes.includes('tax')) required.add('tax_return');
  if (notes.includes('processing') || notes.includes('processor')) required.add('processing_statement');
  if (notes.includes('payoff')) required.add('payoff_letter');
  return Array.from(required);
}

function businessName(context: RecordMap) {
  const business = context.business || {};
  const deal = context.deal || {};
  return text(business.legal_name || business.dba || business.name || deal.title || 'Merchant');
}

function stateFromBusiness(business: RecordMap) {
  return text(business.state || '').toUpperCase();
}

function industryFromBusiness(business: RecordMap) {
  return text(business.industry || business.business_type || business.naics_description).toLowerCase();
}

export function buildCrmAiContext(args: {
  deal: RecordMap;
  business?: RecordMap | null;
  application?: RecordMap | null;
  owners?: RecordMap[];
  documents?: RecordMap[];
  documentRequests?: RecordMap[];
  notes?: RecordMap[];
  riskEvents?: RecordMap[];
  submissions?: RecordMap[];
  offers?: RecordMap[];
  currentPositions?: RecordMap[];
  tasks?: RecordMap[];
  stipulations?: RecordMap[];
  partnerApplications?: RecordMap[];
  fundingPartners?: RecordMap[];
  question?: string;
}) {
  return {
    aiConfigured: Boolean(process.env.AZURE_OPENAI_API_KEY && (process.env.AZURE_OPENAI_RESPONSES_URL || process.env.AZURE_OPENAI_CHAT_COMPLETIONS_URL)),
    aiProvider: 'azure-openai',
    generatedAt: new Date().toISOString(),
    question: text(args.question),
    deal: redactSensitiveFields(args.deal),
    business: redactSensitiveFields(args.business || null),
    application: redactSensitiveFields(args.application || null),
    owners: compactRows(args.owners),
    documents: compactRows(args.documents, 40),
    documentRequests: compactRows(args.documentRequests, 40),
    notes: compactRows(args.notes, 15),
    riskEvents: compactRows(args.riskEvents, 15),
    submissions: compactRows(args.submissions, 20),
    offers: compactRows(args.offers, 15),
    currentPositions: compactRows(args.currentPositions, 10),
    tasks: compactRows(args.tasks, 20),
    stipulations: compactRows(args.stipulations, 15),
    partnerApplications: compactRows(args.partnerApplications, 10),
    fundingPartners: compactRows(args.fundingPartners, 50),
  };
}

function buildApplicationQa(context: RecordMap) {
  const application = context.application || {};
  const payload = application.application_payload || {};
  const business = context.business || {};
  const owners = context.owners || [];
  const firstOwner = owners[0] || payload.owner1 || {};
  const documents = context.documents || [];

  const checks = [
    ['Business legal name', boolPresent(payload.legal_name, payload.company_name, business.legal_name, context.deal?.title)],
    ['Requested amount', boolPresent(context.deal?.requested_amount, application.requested_amount, payload.requested_amount)],
    ['Business address with city/state/ZIP', hasCompleteBusinessLocation({ applicationPayload: payload, business })],
    ['Full EIN / Tax ID evidence', boolPresent(business.ein_last4, payload.ein)],
    ['Owner name', boolPresent(firstOwner.first_name && firstOwner.last_name, firstOwner.full_name, payload.full_name)],
    ['Owner DOB', hasOwnerDobEvidence({ applicationPayload: payload, owner: firstOwner })],
    ['Owner ownership percentage', hasOwnerOwnershipEvidence({ applicationPayload: payload, owner: firstOwner })],
    ['Owner SSN evidence', boolPresent(firstOwner.ssn_last4, firstOwner.ssn, payload.ssn)],
    ['Signature', hasApplicationSignatureEvidence({ application, completedApplicationDocuments: documents })],
  ];
  const blockers = checks.filter(([, passed]) => !passed).map(([label]) => `${label} missing`);
  const verifiedFields = checks.filter(([, passed]) => passed).map(([label]) => String(label));
  const warnings = [
    application.application_review_status && !['submitted', 'approved', 'converted'].includes(application.application_review_status) ? `Application review status is ${application.application_review_status}.` : '',
    context.partnerApplications?.some((row: RecordMap) => ['uploaded', 'extracting', 'failed'].includes(row.status)) ? 'A partner application still needs review or conversion.' : '',
  ].filter(Boolean);
  const score = Math.round((verifiedFields.length / checks.length) * 100);
  return {
    status: blockers.length ? 'blocked' : warnings.length ? 'needs_review' : 'ready',
    score,
    blockers,
    warnings,
    verifiedFields,
    fixes: blockers.map((item) => `Fix ${item.replace(' missing', '').toLowerCase()} before sending.`),
  };
}

function buildDocumentIntelligence(context: RecordMap) {
  const documents = (context.documents || []).filter(documentIsUsable);
  const documentRequests = context.documentRequests || [];
  const requiredTypes = unique([
    ...documentRequests.filter((request: RecordMap) => request.required !== false && !['approved', 'waived'].includes(request.status)).map((request: RecordMap) => text(request.document_type)),
    'completed_application',
    'bank_statements',
    'drivers_license',
  ]);
  const missingDocumentTypes = requiredTypes.filter((type) => !hasDocType(documents, type));
  const reviewed = documents.slice(0, 12).map((doc: RecordMap) => {
    const type = text(doc.document_type || 'other');
    const extraction = doc.ai_extraction || {};
    const signals = [
      doc.status ? `Status: ${doc.status}` : '',
      type.includes('bank') ? 'Bank document available for revenue/cash-flow review.' : '',
      extraction.total_deposits ? `AI deposits: ${extraction.total_deposits}` : '',
      extraction.ending_balance ? `AI ending balance: ${extraction.ending_balance}` : '',
      extraction.negative_days ? `AI negative days: ${extraction.negative_days}` : '',
      extraction.nsf_count ? `AI NSFs: ${extraction.nsf_count}` : '',
      sameCrmDocumentType(type, 'drivers_license') ? 'Owner ID document available.' : '',
      sameCrmDocumentType(type, 'voided_check') ? 'Funding bank account evidence available.' : '',
      sameCrmDocumentType(type, 'completed_application') ? 'Completed application available.' : '',
    ].filter(Boolean);
    return {
      id: text(doc.id),
      label: documentLabel(doc),
      documentType: type,
      confidence: type === 'other' ? 'low' : 'medium',
      signals: signals.length ? signals : ['Document is attached but requires staff review.'],
      nextAction: doc.status === 'uploaded' ? 'Review or approve if acceptable.' : 'Keep in package if relevant.',
    };
  });
  const application = context.application || {};
  const business = context.business || {};
  const bankExtractions = documents.map((doc: RecordMap) => doc.ai_extraction).filter(Boolean);
  const latestBankExtraction = bankExtractions[0] || {};
  const nsfCount = text(application.nsf_count || business.nsf_count || latestBankExtraction.nsf_count || '');
  const negativeDays = text(application.negative_days_count || business.negative_days_count || latestBankExtraction.negative_days || '');
  const monthlyRevenue = money(application.avg_monthly_deposits || business.monthly_gross_revenue || application.application_payload?.average_monthly_sales || latestBankExtraction.total_deposits) || 'See bank statements';
  return {
    status: missingDocumentTypes.length ? 'needs_review' : 'ready',
    documentsReviewed: reviewed,
    extractedSignals: unique(reviewed.flatMap((doc: RecordMap) => doc.signals)),
    missingDocumentTypes,
    bankStatementAnalysis: {
      status: latestBankExtraction.total_deposits || latestBankExtraction.ending_balance ? 'AI bank statement extraction available' : hasDocType(documents, 'bank_statements') || hasDocType(documents, 'bank_statement') ? 'Bank statements attached' : 'Bank statements missing',
      monthlyRevenue,
      negativeDays: negativeDays || 'Not extracted yet',
      nsfCount: nsfCount || 'Not extracted yet',
      notes: [
        latestBankExtraction.bank_name ? `Bank: ${latestBankExtraction.bank_name}` : '',
        latestBankExtraction.statement_period_start || latestBankExtraction.statement_period_end ? `Statement period: ${[latestBankExtraction.statement_period_start, latestBankExtraction.statement_period_end].filter(Boolean).join(' - ')}` : '',
        latestBankExtraction.ending_balance ? `Ending balance: ${latestBankExtraction.ending_balance}` : '',
        latestBankExtraction.provider ? `Extraction provider: ${latestBankExtraction.provider}` : hasDocType(documents, 'bank_statements') ? 'Bank statement is attached but still needs extracted deposit/NSF details.' : 'Collect recent bank statements.',
      ].filter(Boolean),
    },
  };
}

function scoreFunder(context: RecordMap, partner: RecordMap, requiredTypes: string[]) {
  const deal = context.deal || {};
  const business = context.business || {};
  const documents = context.documents || [];
  const amount = numberValue(deal.requested_amount || context.application?.requested_amount);
  const revenue = numberValue(business.monthly_gross_revenue || context.application?.avg_monthly_deposits || context.application?.application_payload?.average_monthly_sales);
  const state = stateFromBusiness(business);
  const industry = industryFromBusiness(business);
  const warnings: string[] = [];
  const reasons: string[] = [];
  const missingRequirements = requiredTypes.filter((type) => !hasDocType(documents, type)).map((type) => type.replaceAll('_', ' '));
  let score = 70;

  if (partner.min_funding_amount && amount && amount < Number(partner.min_funding_amount)) {
    score -= 25;
    warnings.push(`Requested amount is below ${partner.name}'s minimum.`);
  } else if (partner.max_funding_amount && amount && amount > Number(partner.max_funding_amount)) {
    score -= 25;
    warnings.push(`Requested amount is above ${partner.name}'s maximum.`);
  } else if (amount) {
    score += 8;
    reasons.push('Requested amount appears within stated range.');
  }

  if (partner.min_monthly_revenue && revenue && revenue < Number(partner.min_monthly_revenue)) {
    score -= 25;
    warnings.push('Monthly revenue appears below funder minimum.');
  } else if (revenue) {
    score += 8;
    reasons.push('Monthly revenue appears usable for this funder.');
  }

  if (Array.isArray(partner.states_served) && partner.states_served.length && state && !partner.states_served.map((item: string) => item.toUpperCase()).includes(state)) {
    score -= 20;
    warnings.push(`State ${state} is not listed in funder coverage.`);
  } else if (state) {
    reasons.push('Business state does not conflict with saved funder coverage.');
  }

  if (Array.isArray(partner.restricted_industries) && partner.restricted_industries.some((item: string) => industry.includes(text(item).toLowerCase()))) {
    score -= 30;
    warnings.push('Industry may be restricted by this funder.');
  }

  score -= missingRequirements.length * 6;
  if (!missingRequirements.length) reasons.push('Required package docs appear available.');
  if (partner.avg_approval_days) reasons.push(`Typical approval speed: ${partner.avg_approval_days} day(s).`);
  if (!partner.submission_email && !partner.email && !partner.portal_url) warnings.push('No submission route is saved.');

  return {
    fundingPartnerId: text(partner.id),
    name: text(partner.name || 'Unnamed funder'),
    score: clampScore(score),
    reasons: reasons.length ? reasons : ['Potential match based on saved funder profile.'],
    warnings,
    missingRequirements,
    submissionRoute: text(partner.submission_email || partner.email || partner.portal_url || partner.preferred_submission_method || 'manual'),
  };
}

function buildFunderMatches(context: RecordMap) {
  return (context.fundingPartners || [])
    .filter((partner: RecordMap) => partner.is_active !== false && !partner.deleted_at)
    .map((partner: RecordMap) => scoreFunder(context, partner, requiredDocTypesForPartner(partner)))
    .sort((a: RecordMap, b: RecordMap) => b.score - a.score)
    .slice(0, 6);
}

function buildEmailDraft(context: RecordMap, docs: RecordMap[]) {
  const deal = context.deal || {};
  const business = context.business || {};
  const docLabels = docs.map(documentLabel).slice(0, 8);
  return {
    subject: `${businessName(context)} - funding package`,
    body: [
      'Hi,',
      '',
      `Please review the attached funding package for ${businessName(context)}.`,
      '',
      `Requested amount: ${money(deal.requested_amount || context.application?.requested_amount) || 'See application'}`,
      `Monthly revenue: ${money(business.monthly_gross_revenue || context.application?.avg_monthly_deposits) || 'See file'}`,
      docLabels.length ? `Included package: ${docLabels.join(', ')}.` : '',
      '',
      'Please confirm receipt and let us know if you need any additional stips.',
      '',
      'Thank you,',
    ].filter((line) => line !== '').join('\n'),
  };
}

function buildPackageBuilder(context: RecordMap, funderMatches: RecordMap[], applicationQa: RecordMap, documentIntelligence: RecordMap) {
  const selectedPartner = (context.fundingPartners || []).find((partner: RecordMap) => partner.id === funderMatches[0]?.fundingPartnerId) || null;
  const requiredDocumentTypes = requiredDocTypesForPartner(selectedPartner);
  const documents = (context.documents || []).filter(documentIsUsable);
  const requiredIds = requiredDocumentTypes.map((type) => bestDocIdForType(documents, type)).filter(Boolean);
  const eligibleIds = documents
    .filter((doc: RecordMap) => doc.document_type !== 'partner_application' && doc.application_variant !== 'original_partner')
    .map((doc: RecordMap) => doc.id)
    .filter(Boolean);
  const includedDocumentIds = unique([...requiredIds, ...eligibleIds]);
  const missingDocumentTypes = requiredDocumentTypes.filter((type) => !hasDocType(documents, type));
  const warnings = [
    ...applicationQa.blockers,
    ...documentIntelligence.missingDocumentTypes.map((type: string) => `${type.replaceAll('_', ' ')} missing`),
    selectedPartner && !(selectedPartner.submission_email || selectedPartner.email || selectedPartner.portal_url) ? 'Selected funder has no saved submission route.' : '',
  ].filter(Boolean);
  const email = buildEmailDraft(context, includedDocumentIds.map((id) => documents.find((doc: RecordMap) => doc.id === id)).filter(Boolean));
  const readyToSend = !applicationQa.blockers.length && !missingDocumentTypes.length && includedDocumentIds.length > 0;
  return {
    status: readyToSend ? 'ready' : warnings.length ? 'blocked' : 'needs_review',
    readyToSend,
    includedDocumentIds,
    requiredDocumentTypes,
    missingDocumentTypes,
    warnings: unique(warnings),
    emailSubject: email.subject,
    emailBody: email.body,
  };
}

function buildCopilot(context: RecordMap, analysis: RecordMap) {
  const question = text(context.question);
  const missing = analysis.missingItems || [];
  const bestMatch = analysis.funderMatches?.[0];
  const defaultAnswer = [
    `${businessName(context)} is ${analysis.packageBuilder?.readyToSend ? 'close to ready for funder submission' : 'not ready for funder submission yet'}.`,
    missing.length ? `Missing items: ${missing.slice(0, 5).join(', ')}.` : 'No major missing items were found in the AI package plan.',
    bestMatch ? `Best saved funder match: ${bestMatch.name} (${bestMatch.score}%).` : 'No saved funder match was available.',
  ].join(' ');

  return {
    answer: question ? `${defaultAnswer} For your question, review the package plan and funder match notes above before taking action.` : defaultAnswer,
    suggestedQuestions: [
      'What is missing before we send this to funders?',
      'Which funder is the best first submission?',
      'Draft a merchant follow-up for the missing items.',
      'Summarize this deal for underwriting.',
    ],
    sourceNotes: [
      `${(context.documents || []).length} document(s) reviewed`,
      `${(context.fundingPartners || []).length} funder profile(s) compared`,
      `${(context.documentRequests || []).length} checklist item(s) reviewed`,
    ],
  };
}

function fallbackAnalysis(context: RecordMap) {
  const applicationQa = buildApplicationQa(context);
  const documentIntelligence = buildDocumentIntelligence(context);
  const funderMatches = buildFunderMatches(context);
  const packageBuilder = buildPackageBuilder(context, funderMatches, applicationQa, documentIntelligence);
  const missingItems = unique([
    ...applicationQa.blockers,
    ...documentIntelligence.missingDocumentTypes.map((type: string) => type.replaceAll('_', ' ')),
    ...packageBuilder.missingDocumentTypes.map((type: string) => type.replaceAll('_', ' ')),
  ]);
  const riskFlags = [
    ...list(context.riskEvents?.map((event: RecordMap) => event.title || event.event_type || event.notes)),
    numberValue(context.application?.nsf_count) > 0 ? `${context.application.nsf_count} NSF item(s) recorded` : '',
    numberValue(context.application?.negative_days_count) > 0 ? `${context.application.negative_days_count} negative day(s) recorded` : '',
  ].filter(Boolean);
  const email = buildEmailDraft(context, (context.documents || []).filter(documentIsUsable));
  const analysis = {
    summary: `${businessName(context)} is requesting ${money(context.deal?.requested_amount || context.application?.requested_amount) || 'funding'} and is currently in ${text(context.deal?.stage_slug || 'active review').replaceAll('_', ' ')}.`,
    fundingReadiness: packageBuilder.readyToSend ? 'Package appears ready for staff-reviewed funder submission.' : 'Package is not ready until missing application or document items are resolved.',
    riskFlags: riskFlags.length ? riskFlags : ['No major risk flags are recorded in the reviewed CRM fields.'],
    missingItems,
    recommendedNextActions: missingItems.length
      ? [`Resolve ${missingItems[0].toLowerCase()}.`, 'Regenerate the Funding Application after corrections.', 'Refresh AI and package plan before sending.']
      : ['Select the best-fit funder.', 'Send the AI-built package from connected Gmail.', 'Log funder response and next stips.'],
    funderEmailDraft: { subject: packageBuilder.emailSubject || email.subject, body: packageBuilder.emailBody || email.body },
    questionsForMerchant: missingItems.slice(0, 5).map((item) => `Can you provide or confirm ${item.toLowerCase()}?`),
    confidence: context.aiConfigured ? 'medium' : 'low',
    applicationQa,
    documentIntelligence,
    funderMatches,
    packageBuilder,
    copilot: {},
  };
  return { ...analysis, copilot: buildCopilot(context, analysis) };
}

function normalizeAiAnalysis(value: RecordMap, fallback: RecordMap) {
  const applicationQa = {
    status: ['ready', 'needs_review', 'blocked'].includes(value?.applicationQa?.status) ? value.applicationQa.status : fallback.applicationQa.status,
    score: clampScore(value?.applicationQa?.score ?? fallback.applicationQa.score),
    blockers: safeList(value?.applicationQa?.blockers).slice(0, 12),
    warnings: safeList(value?.applicationQa?.warnings).slice(0, 12),
    verifiedFields: safeList(value?.applicationQa?.verifiedFields).slice(0, 20),
    fixes: safeList(value?.applicationQa?.fixes).slice(0, 12),
  };
  const documentIntelligence = {
    status: ['ready', 'needs_review', 'blocked'].includes(value?.documentIntelligence?.status) ? value.documentIntelligence.status : fallback.documentIntelligence.status,
    documentsReviewed: Array.isArray(value?.documentIntelligence?.documentsReviewed) ? value.documentIntelligence.documentsReviewed.slice(0, 12).map((doc: RecordMap) => ({
      id: text(doc.id),
      label: redactSensitiveText(doc.label),
      documentType: redactSensitiveText(doc.documentType),
      confidence: ['low', 'medium', 'high'].includes(doc.confidence) ? doc.confidence : 'medium',
      signals: safeList(doc.signals).slice(0, 6),
      nextAction: redactSensitiveText(doc.nextAction),
    })) : fallback.documentIntelligence.documentsReviewed,
    extractedSignals: safeList(value?.documentIntelligence?.extractedSignals).slice(0, 20),
    missingDocumentTypes: safeList(value?.documentIntelligence?.missingDocumentTypes).slice(0, 20),
    bankStatementAnalysis: {
      status: redactSensitiveText(value?.documentIntelligence?.bankStatementAnalysis?.status || fallback.documentIntelligence.bankStatementAnalysis.status),
      monthlyRevenue: redactSensitiveText(value?.documentIntelligence?.bankStatementAnalysis?.monthlyRevenue || fallback.documentIntelligence.bankStatementAnalysis.monthlyRevenue),
      negativeDays: redactSensitiveText(value?.documentIntelligence?.bankStatementAnalysis?.negativeDays || fallback.documentIntelligence.bankStatementAnalysis.negativeDays),
      nsfCount: redactSensitiveText(value?.documentIntelligence?.bankStatementAnalysis?.nsfCount || fallback.documentIntelligence.bankStatementAnalysis.nsfCount),
      notes: safeList(value?.documentIntelligence?.bankStatementAnalysis?.notes).slice(0, 8),
    },
  };
  const funderMatches = Array.isArray(value?.funderMatches) ? value.funderMatches.slice(0, 6).map((match: RecordMap) => ({
    fundingPartnerId: text(match.fundingPartnerId),
    name: redactSensitiveText(match.name),
    score: clampScore(match.score),
    reasons: safeList(match.reasons).slice(0, 6),
    warnings: safeList(match.warnings).slice(0, 6),
    missingRequirements: safeList(match.missingRequirements).slice(0, 8),
    submissionRoute: redactSensitiveText(match.submissionRoute),
  })) : fallback.funderMatches;
  const packageBuilder = {
    status: ['ready', 'needs_review', 'blocked'].includes(value?.packageBuilder?.status) ? value.packageBuilder.status : fallback.packageBuilder.status,
    readyToSend: Boolean(value?.packageBuilder?.readyToSend),
    includedDocumentIds: list(value?.packageBuilder?.includedDocumentIds),
    requiredDocumentTypes: safeList(value?.packageBuilder?.requiredDocumentTypes),
    missingDocumentTypes: safeList(value?.packageBuilder?.missingDocumentTypes),
    warnings: safeList(value?.packageBuilder?.warnings).slice(0, 12),
    emailSubject: redactSensitiveText(value?.packageBuilder?.emailSubject || fallback.packageBuilder.emailSubject),
    emailBody: redactSensitiveText(value?.packageBuilder?.emailBody || fallback.packageBuilder.emailBody),
  };
  const analysis = {
    summary: redactSensitiveText(value?.summary || fallback.summary),
    fundingReadiness: redactSensitiveText(value?.fundingReadiness || fallback.fundingReadiness),
    riskFlags: safeList(value?.riskFlags).slice(0, 12),
    missingItems: safeList(value?.missingItems).slice(0, 15),
    recommendedNextActions: safeList(value?.recommendedNextActions).slice(0, 8),
    funderEmailDraft: {
      subject: redactSensitiveText(value?.funderEmailDraft?.subject || packageBuilder.emailSubject || fallback.funderEmailDraft.subject),
      body: redactSensitiveText(value?.funderEmailDraft?.body || packageBuilder.emailBody || fallback.funderEmailDraft.body),
    },
    questionsForMerchant: safeList(value?.questionsForMerchant).slice(0, 8),
    confidence: ['low', 'medium', 'high'].includes(value?.confidence) ? value.confidence : 'medium',
    applicationQa,
    documentIntelligence,
    funderMatches,
    packageBuilder,
    copilot: {
      answer: redactSensitiveText(value?.copilot?.answer || fallback.copilot.answer),
      suggestedQuestions: safeList(value?.copilot?.suggestedQuestions).slice(0, 8),
      sourceNotes: safeList(value?.copilot?.sourceNotes).slice(0, 8),
    },
  };
  if (!analysis.riskFlags.length) analysis.riskFlags = fallback.riskFlags;
  if (!analysis.missingItems.length) analysis.missingItems = fallback.missingItems;
  if (!analysis.recommendedNextActions.length) analysis.recommendedNextActions = fallback.recommendedNextActions;
  if (!analysis.questionsForMerchant.length) analysis.questionsForMerchant = fallback.questionsForMerchant;
  return enforceDeterministicAiGuardrails(analysis, fallback);
}

function mergeFunderMatchesWithFallback(matches: RecordMap[], fallbackMatches: RecordMap[]) {
  const merged = matches.map((match) => {
    const fallbackMatch = fallbackMatches.find((item) => item.fundingPartnerId === match.fundingPartnerId);
    if (!fallbackMatch) return match;
    const deterministicMissing = (fallbackMatch.missingRequirements || []).map(redactSensitiveText);
    return {
      ...match,
      score: deterministicMissing.length ? Math.min(match.score, fallbackMatch.score) : match.score,
      warnings: unique([...(match.warnings || []), ...(fallbackMatch.warnings || []).map(redactSensitiveText)]).slice(0, 8),
      missingRequirements: unique([...(match.missingRequirements || []), ...deterministicMissing]).slice(0, 10),
    };
  });
  const mergedIds = new Set(merged.map((match) => match.fundingPartnerId));
  return [
    ...merged,
    ...fallbackMatches.filter((match) => !mergedIds.has(match.fundingPartnerId)),
  ].slice(0, 6);
}

function enforceDeterministicAiGuardrails(analysis: RecordMap, fallback: RecordMap) {
  const fallbackApplicationBlockers = safeList(fallback.applicationQa?.blockers);
  const fallbackApplicationWarnings = safeList(fallback.applicationQa?.warnings);
  const fallbackDocumentMissing = safeList(fallback.documentIntelligence?.missingDocumentTypes);
  const fallbackPackageMissing = safeList(fallback.packageBuilder?.missingDocumentTypes);
  const fallbackPackageWarnings = safeList(fallback.packageBuilder?.warnings);
  const forcedMissingItems = unique([
    ...safeList(fallback.missingItems),
    ...fallbackApplicationBlockers,
    ...fallbackDocumentMissing.map((type) => type.replaceAll('_', ' ')),
    ...fallbackPackageMissing.map((type) => type.replaceAll('_', ' ')),
  ]);

  analysis.applicationQa.blockers = unique([...analysis.applicationQa.blockers, ...fallbackApplicationBlockers]).slice(0, 16);
  analysis.applicationQa.warnings = unique([...analysis.applicationQa.warnings, ...fallbackApplicationWarnings]).slice(0, 16);
  analysis.applicationQa.fixes = unique([
    ...analysis.applicationQa.fixes,
    ...safeList(fallback.applicationQa?.fixes),
  ]).slice(0, 16);
  if (fallbackApplicationBlockers.length) {
    analysis.applicationQa.status = 'blocked';
    analysis.applicationQa.score = Math.min(analysis.applicationQa.score, clampScore(fallback.applicationQa?.score));
  }

  analysis.documentIntelligence.missingDocumentTypes = unique([
    ...analysis.documentIntelligence.missingDocumentTypes,
    ...fallbackDocumentMissing,
  ]).slice(0, 24);
  if (fallbackDocumentMissing.length && analysis.documentIntelligence.status === 'ready') {
    analysis.documentIntelligence.status = 'needs_review';
  }

  analysis.packageBuilder.requiredDocumentTypes = unique([
    ...safeList(fallback.packageBuilder?.requiredDocumentTypes),
    ...analysis.packageBuilder.requiredDocumentTypes,
  ]);
  analysis.packageBuilder.missingDocumentTypes = unique([
    ...analysis.packageBuilder.missingDocumentTypes,
    ...fallbackPackageMissing,
  ]).slice(0, 24);
  analysis.packageBuilder.warnings = unique([
    ...analysis.packageBuilder.warnings,
    ...fallbackPackageWarnings,
    ...fallbackApplicationBlockers,
    ...fallbackDocumentMissing.map((type) => `${type.replaceAll('_', ' ')} missing`),
  ]).slice(0, 18);

  if (!fallback.packageBuilder?.readyToSend) {
    analysis.packageBuilder.readyToSend = false;
    analysis.packageBuilder.status = analysis.packageBuilder.warnings.length || fallbackApplicationBlockers.length || fallbackPackageMissing.length ? 'blocked' : 'needs_review';
  }

  analysis.missingItems = unique([...analysis.missingItems, ...forcedMissingItems]).slice(0, 20);
  if (forcedMissingItems.length && !analysis.recommendedNextActions.some((item: string) => item.toLowerCase().includes('resolve'))) {
    analysis.recommendedNextActions = unique([
      `Resolve ${forcedMissingItems[0].toLowerCase()}.`,
      ...analysis.recommendedNextActions,
    ]).slice(0, 8);
  }
  analysis.funderMatches = mergeFunderMatchesWithFallback(analysis.funderMatches || [], fallback.funderMatches || []);
  return analysis;
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
  const fallback = fallbackAnalysis(context);
  return [
    {
      role: 'system',
      content: [
        'You are the internal AI operating layer for Elite Funding Solutions CRM.',
        'Use only the provided CRM context and rules fallback.',
        'Do not make final underwriting, legal, or credit approval decisions.',
        'Use the word funder, not lender.',
        'Focus on getting a complete, accurate, signed funding package to the right funder.',
        'Return only valid JSON matching the schema.',
        `JSON schema: ${JSON.stringify(aiAnalysisSchema)}`,
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        question: context.question,
        context: redactSensitiveFields(context),
        rulesFallback: fallback,
      }),
    },
  ];
}

async function generateOpenAiAnalysis(context: RecordMap) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const messages = buildAiMessages(context);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: messages.map((message) => ({ role: message.role, content: [{ type: 'input_text', text: message.content }] })),
      text: { format: { type: 'json_schema', name: 'elite_crm_ai_operating_layer', schema: aiAnalysisSchema, strict: true } },
      max_output_tokens: 4200,
    }),
  });
  if (!response.ok) throw new Error(`AI provider error (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const outputText = extractOutputText(await response.json());
  if (!outputText) throw new Error('AI provider returned an empty analysis.');
  return JSON.parse(outputText);
}

async function generateAzureOpenAiResponsesAnalysis(context: RecordMap) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const responsesUrl = process.env.AZURE_OPENAI_RESPONSES_URL;
  if (!apiKey || !responsesUrl) return null;
  const messages = buildAiMessages(context);
  const response = await fetch(responsesUrl, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.AZURE_OPENAI_MODEL || 'gpt-4.1-mini',
      input: messages.map((message) => ({ role: message.role, content: [{ type: 'input_text', text: message.content }] })),
      text: { format: { type: 'json_schema', name: 'elite_crm_ai_operating_layer', schema: aiAnalysisSchema, strict: true } },
      max_output_tokens: 4200,
    }),
  });
  if (!response.ok) throw new Error(`Azure Responses provider error (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const outputText = extractOutputText(await response.json());
  if (!outputText) throw new Error('Azure Responses provider returned an empty analysis.');
  return JSON.parse(outputText);
}

async function generateAzureOpenAiChatAnalysis(context: RecordMap) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const completionsUrl = process.env.AZURE_OPENAI_CHAT_COMPLETIONS_URL;
  if (!apiKey || !completionsUrl) return null;
  const response = await fetch(completionsUrl, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: buildAiMessages(context),
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4200,
    }),
  });
  if (!response.ok) throw new Error(`Azure AI provider error (${response.status}): ${(await response.text()).slice(0, 240)}`);
  const data = await response.json();
  const outputText = data.choices?.[0]?.message?.content;
  if (!outputText) throw new Error('Azure AI provider returned an empty analysis.');
  return JSON.parse(outputText);
}

export async function generateCrmAiAnalysis(context: RecordMap): Promise<{ provider: AiProvider; configured: boolean; analysis: RecordMap; warning?: string }> {
  const fallback = fallbackAnalysis(context);
  try {
    const azureAnalysis = await generateAzureOpenAiResponsesAnalysis(context) || await generateAzureOpenAiChatAnalysis(context);
    if (azureAnalysis) return { provider: 'azure-openai', configured: true, analysis: normalizeAiAnalysis(azureAnalysis, fallback) };
  } catch (error) {
    if (!ALLOW_OPENAI_FALLBACK && AI_PROVIDER !== 'openai') {
      return { provider: 'rules', configured: false, warning: error instanceof Error ? error.message : 'Azure AI failed.', analysis: fallback };
    }
  }

  if (AI_PROVIDER === 'openai' || ALLOW_OPENAI_FALLBACK) {
    try {
      const openAiAnalysis = await generateOpenAiAnalysis(context);
      if (openAiAnalysis) return { provider: 'openai', configured: true, analysis: normalizeAiAnalysis(openAiAnalysis, fallback) };
    } catch (error) {
      return { provider: 'rules', configured: false, warning: error instanceof Error ? error.message : 'OpenAI failed.', analysis: fallback };
    }
  }

  return { provider: 'rules', configured: false, analysis: fallback };
}

export function summarizeAiForDeal(analysis: RecordMap) {
  return [
    analysis.summary,
    analysis.applicationQa?.status ? `Application QA: ${analysis.applicationQa.status} (${analysis.applicationQa.score}%).` : '',
    analysis.packageBuilder?.status ? `Package: ${analysis.packageBuilder.status}.` : '',
    analysis.funderMatches?.[0]?.name ? `Best funder match: ${analysis.funderMatches[0].name} (${analysis.funderMatches[0].score}%).` : '',
  ].filter(Boolean).join(' ');
}
