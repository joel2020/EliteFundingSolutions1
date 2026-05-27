export type StatementTransaction = {
  date: string | null;
  description: string;
  amount: number;
  balance: number | null;
  kind: 'deposit' | 'withdrawal';
};

export type DetectedPosition = {
  funder_name: string;
  payment_amount: number;
  payment_frequency: 'daily' | 'weekly';
  occurrences: number;
  first_seen: string | null;
  last_seen: string | null;
  confidence: number;
};

export type BankStatementAnalysis = {
  total_deposits: number;
  total_withdrawals: number;
  net_cash_flow: number;
  average_daily_ledger_balance: number | null;
  negative_balance_days_per_month: number;
  nsf_count: number;
  position_count: number;
  detected_positions: DetectedPosition[];
  transactions: StatementTransaction[];
  confidence: number;
  extraction_notes: string;
  ai_summary?: string;
  ai_risk_flags?: string[];
  ai_underwriting_notes?: string[];
  ai_lender_match_notes?: string[];
  ai_provider?: string;
};

const datePattern = /\b(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/;
const moneyPattern = /(?:\(?-?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?|\(?-?\$?\s?\d+\.\d{2}\)?)/g;
const debitWords = /\b(withdrawal|debit|ach debit|payment|purchase|fee|atm|check|pos|card|wire out|transfer out|withdraw)\b/i;
const creditWords = /\b(deposit|credit|ach credit|merchant services|batch|settlement|wire in|transfer in)\b/i;
const nsfWords = /\b(nsf|non[-\s]?sufficient|returned item|return item|overdraft)\b/i;

function cleanup(value: string) {
  return value.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseMoney(value: string) {
  const negative = value.includes('(') || value.trim().startsWith('-');
  const amount = Number(value.replace(/[()$,\s-]/g, ''));
  if (!Number.isFinite(amount)) return null;
  return negative ? -amount : amount;
}

function isoDate(value: string | null) {
  if (!value) return null;
  const normalized = value.includes('/') && value.split('/').length === 2 ? `${value}/${new Date().getFullYear()}` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function descriptionKey(value: string) {
  return cleanup(value)
    .replace(datePattern, '')
    .replace(moneyPattern, '')
    .replace(/\b\d{3,}\b/g, '')
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 70);
}

function parseTransactions(text: string) {
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanup)
    .filter((line) => line.length > 8 && datePattern.test(line));

  const transactions: StatementTransaction[] = [];

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    const moneyMatches = line.match(moneyPattern) || [];
    if (!dateMatch || !moneyMatches.length) continue;

    const amounts = moneyMatches.map(parseMoney).filter((amount): amount is number => amount !== null);
    if (!amounts.length) continue;

    const hasBalance = amounts.length >= 2;
    const balance = hasBalance ? amounts[amounts.length - 1] : null;
    let amount = hasBalance ? amounts[amounts.length - 2] : amounts[0];

    if (creditWords.test(line) && amount < 0) amount = Math.abs(amount);
    if (debitWords.test(line) && amount > 0) amount = -amount;
    if (!creditWords.test(line) && !debitWords.test(line) && moneyMatches.some((match) => match.includes('('))) amount = -Math.abs(amount);

    if (amount === 0) continue;
    transactions.push({
      date: isoDate(dateMatch[0]),
      description: line,
      amount,
      balance,
      kind: amount >= 0 ? 'deposit' : 'withdrawal',
    });
  }

  return transactions;
}

function detectPositions(transactions: StatementTransaction[]) {
  const debits = transactions.filter((row) => row.kind === 'withdrawal' && Math.abs(row.amount) >= 25);
  const groups = new Map<string, StatementTransaction[]>();

  for (const row of debits) {
    const roundedAmount = Math.round(Math.abs(row.amount));
    const key = `${descriptionKey(row.description)}:${roundedAmount}`;
    if (!descriptionKey(row.description)) continue;
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  const positions: DetectedPosition[] = [];
  for (const rows of Array.from(groups.values())) {
    const datedRows = rows.filter((row: StatementTransaction) => row.date).sort((a: StatementTransaction, b: StatementTransaction) => String(a.date).localeCompare(String(b.date)));
    if (datedRows.length < 2) continue;

    const gaps = datedRows.slice(1).map((row: StatementTransaction, index: number) => {
      const prior = new Date(datedRows[index].date || '').getTime();
      const current = new Date(row.date || '').getTime();
      return Math.round((current - prior) / 86400000);
    }).filter((gap: number) => Number.isFinite(gap) && gap > 0);

    const daily = gaps.filter((gap: number) => gap >= 1 && gap <= 3).length;
    const weekly = gaps.filter((gap: number) => gap >= 5 && gap <= 9).length;
    const recurring = daily || weekly || datedRows.length >= 3;
    if (!recurring) continue;

    const averagePayment = datedRows.reduce((sum: number, row: StatementTransaction) => sum + Math.abs(row.amount), 0) / datedRows.length;
    positions.push({
      funder_name: descriptionKey(datedRows[0].description).replace(/\b\w/g, (char) => char.toUpperCase()) || 'Recurring debit',
      payment_amount: Math.round(averagePayment * 100) / 100,
      payment_frequency: daily >= weekly ? 'daily' : 'weekly',
      occurrences: datedRows.length,
      first_seen: datedRows[0].date,
      last_seen: datedRows[datedRows.length - 1].date,
      confidence: Math.min(95, 55 + datedRows.length * 10 + Math.max(daily, weekly) * 5),
    });
  }

  return positions.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
}

async function extractPdfText(bytes: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true, useSystemFonts: true } as any).promise;
  const pageTexts: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item: any) => ('str' in item ? item.str : '')).join('\n'));
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  return pageTexts.join('\n');
}

async function ocrPdfText(bytes: Buffer) {
  const [{ createCanvas }, { recognize }, pdfjs] = await Promise.all([
    import('@napi-rs/canvas'),
    import('tesseract.js'),
    import('pdfjs-dist/legacy/build/pdf.mjs'),
  ]);
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), disableWorker: true, useSystemFonts: true } as any).promise;
  const pageTexts: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= Math.min(document.numPages, 6); pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d') as any, viewport } as any).promise;
      const ocr = await recognize(canvas.toBuffer('image/png'), 'eng');
      pageTexts.push(ocr.data.text || '');
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  return pageTexts.join('\n');
}

async function ocrImageText(bytes: Buffer) {
  const { recognize } = await import('tesseract.js');
  const ocr = await recognize(bytes, 'eng');
  return ocr.data.text || '';
}

export async function extractStatementText(bytes: Buffer, mimeType?: string | null, fileName?: string | null) {
  const lowerName = String(fileName || '').toLowerCase();
  const isPdf = mimeType === 'application/pdf' || lowerName.endsWith('.pdf');
  if (isPdf) {
    const text = await extractPdfText(bytes);
    if (cleanup(text).length >= 120) return { text, mode: 'pdf_text' };
    return { text: await ocrPdfText(bytes), mode: 'pdf_ocr' };
  }
  return { text: await ocrImageText(bytes), mode: 'image_ocr' };
}

export function analyzeBankStatementText(texts: string[]): BankStatementAnalysis {
  const text = texts.join('\n');
  const transactions = parseTransactions(text);
  const totalDeposits = transactions.filter((row) => row.kind === 'deposit').reduce((sum, row) => sum + row.amount, 0);
  const totalWithdrawals = transactions.filter((row) => row.kind === 'withdrawal').reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const balances = transactions.map((row) => row.balance).filter((value): value is number => value !== null && Number.isFinite(value));
  const negativeDays = new Set(transactions.filter((row) => row.balance !== null && row.balance < 0 && row.date).map((row) => row.date));
  const months = new Set(transactions.filter((row) => row.date).map((row) => String(row.date).slice(0, 7)));
  const nsfCount = (text.match(new RegExp(nsfWords.source, 'gi')) || []).length;
  const detectedPositions = detectPositions(transactions);
  const averageBalance = balances.length ? balances.reduce((sum, value) => sum + value, 0) / balances.length : null;
  const confidence = Math.min(98, Math.round((transactions.length ? 55 : 20) + Math.min(transactions.length, 60) * 0.55 + detectedPositions.length * 4));

  return {
    total_deposits: Math.round(totalDeposits * 100) / 100,
    total_withdrawals: Math.round(totalWithdrawals * 100) / 100,
    net_cash_flow: Math.round((totalDeposits - totalWithdrawals) * 100) / 100,
    average_daily_ledger_balance: averageBalance === null ? null : Math.round(averageBalance * 100) / 100,
    negative_balance_days_per_month: months.size ? Math.round(negativeDays.size / months.size) : negativeDays.size,
    nsf_count: nsfCount,
    position_count: detectedPositions.length,
    detected_positions: detectedPositions,
    transactions,
    confidence,
    extraction_notes: `${transactions.length} transaction-like rows parsed across ${texts.length} statement file(s).`,
  };
}

function getAzureChatConfig() {
  const url = process.env.AZURE_OPENAI_CHAT_COMPLETIONS_URL;
  const key = process.env.AZURE_OPENAI_API_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function coerceStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 12)
    : [];
}

function extractJsonObject(value: string) {
  const direct = value.trim();
  try {
    return JSON.parse(direct);
  } catch {
    const match = direct.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function enrichBankStatementAnalysisWithAzureAI(texts: string[], analysis: BankStatementAnalysis) {
  const config = getAzureChatConfig();
  if (!config) return analysis;

  const sampleText = texts.join('\n').slice(0, 24000);
  const transactionSample = analysis.transactions.slice(0, 80).map((row) => ({
    date: row.date,
    description: row.description.slice(0, 180),
    amount: row.amount,
    balance: row.balance,
    kind: row.kind,
  }));

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'api-key': config.key,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a commercial finance underwriting analyst for merchant cash advance and working-capital submissions. Return strict JSON only. Do not invent facts not supported by the metrics or statement text.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'Review bank statement extraction output. Produce concise underwriting notes for CRM staff.',
              required_json_shape: {
                summary: '2-4 sentences',
                risk_flags: ['short risk flag strings'],
                underwriting_notes: ['short operational notes'],
                lender_match_notes: ['short lender matching notes'],
              },
              parsed_metrics: {
                total_deposits: analysis.total_deposits,
                total_withdrawals: analysis.total_withdrawals,
                net_cash_flow: analysis.net_cash_flow,
                average_daily_ledger_balance: analysis.average_daily_ledger_balance,
                negative_balance_days_per_month: analysis.negative_balance_days_per_month,
                nsf_count: analysis.nsf_count,
                position_count: analysis.position_count,
                detected_positions: analysis.detected_positions,
                parser_confidence: analysis.confidence,
              },
              transaction_sample: transactionSample,
              statement_text_sample: sampleText,
            }),
          },
        ],
        temperature: 0.1,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return {
        ...analysis,
        ai_provider: 'azure_openai',
        extraction_notes: `${analysis.extraction_notes} Azure OpenAI enrichment skipped: HTTP ${response.status}.`,
      };
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = typeof content === 'string' ? extractJsonObject(content) : null;
    if (!parsed || typeof parsed !== 'object') {
      return {
        ...analysis,
        ai_provider: 'azure_openai',
        extraction_notes: `${analysis.extraction_notes} Azure OpenAI enrichment returned no usable JSON.`,
      };
    }

    return {
      ...analysis,
      ai_summary: typeof (parsed as any).summary === 'string' ? (parsed as any).summary.trim().slice(0, 1400) : undefined,
      ai_risk_flags: coerceStringArray((parsed as any).risk_flags),
      ai_underwriting_notes: coerceStringArray((parsed as any).underwriting_notes),
      ai_lender_match_notes: coerceStringArray((parsed as any).lender_match_notes),
      ai_provider: 'azure_openai',
    };
  } catch (error) {
    return {
      ...analysis,
      ai_provider: 'azure_openai',
      extraction_notes: `${analysis.extraction_notes} Azure OpenAI enrichment failed; parser metrics were saved.`,
    };
  }
}
