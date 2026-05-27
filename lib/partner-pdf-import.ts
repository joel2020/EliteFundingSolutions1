import { digitsOnly } from '@/lib/security';

export type ImportedPartnerApplication = {
  legal_name: string;
  dba: string;
  entity_type: string;
  industry: string;
  start_date: string;
  business_phone: string;
  business_email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  requested_amount: string;
  use_of_funds: string;
  monthly_gross_revenue: string;
  average_monthly_sales: string;
  bank_name: string;
  account_type: string;
  ein: string;
  owner1: {
    first_name: string;
    last_name: string;
    title: string;
    ownership_pct: string;
    email: string;
    phone: string;
    mobile: string;
    dob: string;
    ssn: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  signature: string;
  signature_date: string;
  extracted_text_preview: string;
  extraction_confidence: number;
};

const fieldLabels: Record<keyof Omit<ImportedPartnerApplication, 'owner1' | 'extracted_text_preview' | 'extraction_confidence'>, string[]> = {
  legal_name: ['legal business name', 'business legal name', 'merchant legal name', 'company legal name', 'company name', 'business name'],
  dba: ['dba', 'trade name'],
  entity_type: ['entity type', 'business type', 'legal entity'],
  industry: ['industry', 'business industry', 'type of business'],
  start_date: ['business start date', 'start date', 'date established', 'in business since'],
  business_phone: ['business phone', 'company phone', 'merchant phone', 'phone number'],
  business_email: ['business email', 'company email', 'merchant email', 'email address'],
  website: ['website', 'business website'],
  address: ['business address', 'company address', 'merchant address', 'physical address', 'street address'],
  city: ['business city', 'city'],
  state: ['business state', 'state'],
  zip: ['business zip', 'zip', 'postal code'],
  requested_amount: ['requested amount', 'funding amount requested', 'amount requested', 'loan amount', 'advance amount'],
  use_of_funds: ['use of funds', 'purpose of funds', 'funding purpose'],
  monthly_gross_revenue: ['monthly gross revenue', 'gross monthly revenue', 'monthly revenue', 'average monthly revenue'],
  average_monthly_sales: ['average monthly sales', 'monthly sales', 'average deposits', 'monthly deposits'],
  bank_name: ['bank name', 'business bank', 'primary bank'],
  account_type: ['account type'],
  ein: ['ein', 'federal tax id', 'tax id', 'tax identification number'],
  signature: ['signature', 'signed by', 'authorized signature', 'applicant signature', 'owner signature'],
  signature_date: ['signature date', 'signed date', 'date signed', 'date'],
};

const ownerLabels = {
  name: ['owner name', 'principal name', 'applicant name', 'guarantor name', 'signer name'],
  title: ['owner title', 'title'],
  ownership_pct: ['ownership percentage', 'ownership %', 'ownership', 'percent ownership'],
  email: ['owner email', 'principal email', 'applicant email'],
  phone: ['owner phone', 'principal phone', 'applicant phone', 'cell phone', 'mobile phone'],
  dob: ['date of birth', 'dob', 'birth date'],
  ssn: ['ssn', 'social security number', 'social'],
  address: ['owner address', 'home address', 'principal address', 'residential address'],
  city: ['owner city', 'home city'],
  state: ['owner state', 'home state'],
  zip: ['owner zip', 'home zip'],
};

function clean(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s:|\-#]+/, '')
    .replace(/[\s|]+$/, '')
    .trim();
}

function redactSensitive(value: string) {
  return value
    .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, (match) => `***-**-${digitsOnly(match).slice(-4)}`)
    .replace(/\b\d{2}[-\s]?\d{7}\b/g, (match) => `**-***${digitsOnly(match).slice(-4)}`)
    .replace(/\b(account|routing)\s*[:#-]?\s*\d{4,17}\b/gi, '$1: ****');
}

function linesFrom(text: string) {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(clean)
    .filter(Boolean);
}

function valueAfterLabel(lines: string[], labels: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();

    for (const label of labels) {
      const labelIndex = lower.indexOf(label);
      if (labelIndex === -1) continue;

      const inline = clean(line.slice(labelIndex + label.length));
      if (inline && !labels.some((other) => inline.toLowerCase() === other)) return inline;

      const next = lines[index + 1];
      if (next && !next.toLowerCase().includes(label)) return clean(next);
    }
  }

  return '';
}

function firstEmail(text: string, fallback = '') {
  return fallback || text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
}

function firstPhone(text: string, fallback = '') {
  return fallback || text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)?.[0] || '';
}

function firstMoney(text: string, fallback = '') {
  return fallback || text.match(/\$?\s?\d{2,3}(?:,\d{3})+(?:\.\d{2})?|\$\s?\d{4,}(?:\.\d{2})?/)?.[0] || '';
}

function firstDate(text: string, fallback = '') {
  return fallback || text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/)?.[0] || '';
}

function splitName(fullName: string) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
  };
}

function normalizeEntityType(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes('llc') || lower.includes('limited liability')) return 'llc';
  if (lower.includes('s corp') || lower.includes('s-corp') || lower.includes('s corporation')) return 's_corp';
  if (lower.includes('c corp') || lower.includes('c-corp') || lower.includes('corporation')) return 'c_corp';
  if (lower.includes('sole')) return 'sole_proprietor';
  if (lower.includes('partner')) return 'partnership';
  if (lower.includes('non')) return 'non_profit';
  return value ? 'other' : '';
}

function confidence(data: ImportedPartnerApplication) {
  const checks = [
    data.legal_name,
    data.business_phone || data.owner1.phone,
    data.business_email || data.owner1.email,
    data.requested_amount,
    data.owner1.first_name,
    data.signature,
    data.signature_date,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

async function loadPdfText(pdfBytes: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    useSystemFonts: true,
  } as any).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item: any) => ('str' in item ? item.str : '')).join('\n'));
    page.cleanup();
  }

  await document.destroy();
  return textCleanup(pageTexts.join('\n'));
}

function textCleanup(value: string) {
  return value.replace(/\u0000/g, ' ');
}

async function ocrPdfText(pdfBytes: Buffer) {
  const [{ createCanvas }, { recognize }, pdfjs] = await Promise.all([
    import('@napi-rs/canvas'),
    import('tesseract.js'),
    import('pdfjs-dist/legacy/build/pdf.mjs'),
  ]);
  const document = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    useSystemFonts: true,
  } as any).promise;
  const pageTexts: string[] = [];
  const maxPages = Math.min(document.numPages, 5);

  try {
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d') as any;

      await page.render({
        canvasContext: context,
        viewport,
        canvasFactory: {
          create(width: number, height: number) {
            const createdCanvas = createCanvas(width, height);
            return { canvas: createdCanvas as any, context: createdCanvas.getContext('2d') as any };
          },
          reset(canvasAndContext: any, width: number, height: number) {
            canvasAndContext.canvas.width = width;
            canvasAndContext.canvas.height = height;
          },
          destroy(canvasAndContext: any) {
            canvasAndContext.canvas.width = 0;
            canvasAndContext.canvas.height = 0;
          },
        },
      } as any).promise;

      const png = canvas.toBuffer('image/png');
      const ocr = await recognize(png, 'eng');
      pageTexts.push(ocr.data.text || '');
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  return textCleanup(pageTexts.join('\n'));
}

export async function extractPartnerApplicationFromPdf(pdfBytes: Buffer): Promise<ImportedPartnerApplication> {
  let text = await loadPdfText(pdfBytes);
  let extractionMode: 'text' | 'ocr' = 'text';

  if (text.trim().length < 80) {
    text = await ocrPdfText(pdfBytes);
    extractionMode = 'ocr';
  }

  const normalizedText = text;
  const lines = linesFrom(normalizedText);

  if (normalizedText.trim().length < 80) {
    throw new Error('No readable text was found in this PDF after OCR. Upload a clearer partner application PDF.');
  }

  const get = (key: keyof typeof fieldLabels) => valueAfterLabel(lines, fieldLabels[key]);
  const ownerName = valueAfterLabel(lines, ownerLabels.name) || get('signature');
  const ownerSplit = splitName(ownerName);

  const data: ImportedPartnerApplication = {
    legal_name: get('legal_name'),
    dba: get('dba'),
    entity_type: normalizeEntityType(get('entity_type')),
    industry: get('industry'),
    start_date: firstDate(normalizedText, get('start_date')),
    business_phone: firstPhone(normalizedText, get('business_phone')),
    business_email: firstEmail(normalizedText, get('business_email')),
    website: get('website'),
    address: get('address'),
    city: get('city'),
    state: get('state').slice(0, 2).toUpperCase(),
    zip: digitsOnly(get('zip')).slice(0, 10),
    requested_amount: firstMoney(normalizedText, get('requested_amount')),
    use_of_funds: get('use_of_funds'),
    monthly_gross_revenue: firstMoney(normalizedText, get('monthly_gross_revenue')),
    average_monthly_sales: firstMoney(normalizedText, get('average_monthly_sales')),
    bank_name: get('bank_name'),
    account_type: get('account_type').toLowerCase().includes('saving') ? 'savings' : 'checking',
    ein: digitsOnly(get('ein')).slice(0, 9),
    owner1: {
      ...ownerSplit,
      title: valueAfterLabel(lines, ownerLabels.title),
      ownership_pct: digitsOnly(valueAfterLabel(lines, ownerLabels.ownership_pct)).slice(0, 3),
      email: firstEmail(normalizedText, valueAfterLabel(lines, ownerLabels.email)),
      phone: firstPhone(normalizedText, valueAfterLabel(lines, ownerLabels.phone)),
      mobile: firstPhone(normalizedText, valueAfterLabel(lines, ownerLabels.phone)),
      dob: firstDate(normalizedText, valueAfterLabel(lines, ownerLabels.dob)),
      ssn: digitsOnly(valueAfterLabel(lines, ownerLabels.ssn)).slice(0, 9),
      address: valueAfterLabel(lines, ownerLabels.address),
      city: valueAfterLabel(lines, ownerLabels.city),
      state: valueAfterLabel(lines, ownerLabels.state).slice(0, 2).toUpperCase(),
      zip: digitsOnly(valueAfterLabel(lines, ownerLabels.zip)).slice(0, 10),
    },
    signature: get('signature') || ownerName,
    signature_date: firstDate(normalizedText, get('signature_date')),
    extracted_text_preview: `[${extractionMode.toUpperCase()}]\n${redactSensitive(normalizedText).slice(0, 6000)}`,
    extraction_confidence: 0,
  };

  if (!data.legal_name) data.legal_name = data.dba || 'Imported Partner Application';
  if (!data.business_email) data.business_email = data.owner1.email;
  if (!data.owner1.email) data.owner1.email = data.business_email;
  if (!data.owner1.phone) data.owner1.phone = data.business_phone;
  if (!data.owner1.mobile) data.owner1.mobile = data.owner1.phone;
  if (!data.signature) data.signature = [data.owner1.first_name, data.owner1.last_name].filter(Boolean).join(' ');
  if (!data.signature_date) data.signature_date = new Date().toISOString().slice(0, 10);
  data.extraction_confidence = confidence(data);

  return data;
}
