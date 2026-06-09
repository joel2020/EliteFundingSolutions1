import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { APPLICATION_DISCLOSURE_SECTIONS } from './application-disclosures';

type Owner = Record<string, any>;

export type LenderApplicationPdfData = {
  deal?: Record<string, any> | null;
  application?: Record<string, any> | null;
  business?: Record<string, any> | null;
  owners?: Owner[];
  ein?: string | null;
  drawnSignaturePng?: Buffer | null;
};

export type ResolvedLenderApplicationPdfFields = {
  businessLegalName: string;
  businessDba: string;
  businessStreet: string;
  businessCityLine: string;
  businessState: string;
  businessZip: string;
  businessSuite: string;
  businessPhone: string;
  businessMobile: string;
  businessFax: string;
  businessWebsite: string;
  businessEmail: string;
  ein: string;
  businessStartDate: string;
  productsServices: string;
  posContact: string;
  posSystem: string;
  entityType: string;
  merchantType: string;
  businessLocation: string;
  hasRisk: boolean;
  riskNotes: string;
  isSeasonal: boolean;
  owner1: ResolvedOwnerPdfFields;
  owner2: ResolvedOwnerPdfFields;
  hasExistingAdvance: boolean;
  existingAdvanceFunder: string;
  existingAdvanceOriginalAmount: string;
  existingAdvanceBalance: string;
  existingAdvanceDailyPayment: string;
  existingAdvancePaymentFrequency: string;
  requestedAmount: string;
  useOfFunds: string;
  desiredTimeline: string;
  averageMonthlySales: string;
  averageVisaMcSales: string;
  bankName: string;
  bankContact: string;
  bankPhone: string;
  accountType: string;
  signer: string;
  signatureDate: string;
  drawnSignaturePng: Buffer | null;
};

export type ResolvedOwnerPdfFields = {
  name: string;
  street: string;
  cityLine: string;
  phone: string;
  email: string;
  ownershipPercentage: string;
  dob: string;
  ssn: string;
  driversLicense: string;
};

const templatePath = path.join(process.cwd(), 'public', 'templates', 'elite-funding-lender-application-template.pdf');
const logoPath = path.join(process.cwd(), 'public', 'Elite_Funding_Solutions_Logo_Final.jpg');

function text(value: unknown) {
  return String(value ?? '').trim();
}

function money(value: unknown) {
  const amount = Number(String(value ?? '').replace(/[$,]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `$${amount.toLocaleString()}`;
}

function dateValue(value: unknown) {
  const raw = text(value);
  if (!raw) return '';
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${Number(month)}/${Number(day)}/${year}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-US');
}

function digitsOnly(value: unknown) {
  return text(value).replace(/\D/g, '');
}

function formatEin(value: unknown) {
  const digits = digitsOnly(value);
  if (digits.length !== 9) return text(value);
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function formatFullEin(value: unknown) {
  const digits = digitsOnly(value);
  if (digits.length !== 9) return '';
  return formatEin(digits);
}

function formatSsn(value: unknown) {
  const digits = digitsOnly(value);
  if (digits.length !== 9) return text(value);
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function formatFullSsn(value: unknown) {
  const digits = digitsOnly(value);
  if (digits.length !== 9) return '';
  return formatSsn(digits);
}

function formatOwnership(value: unknown) {
  const raw = text(value);
  if (!raw) return '';
  return raw.endsWith('%') ? raw : `${raw}%`;
}

function splitAddress(value: unknown) {
  const raw = text(value);
  if (!raw) return { address: '', city: '', state: '', zip: '' };
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  const parseStateZip = (value: string) => {
    const match = value.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/i);
    return match ? { state: match[1].toUpperCase(), zip: match[2] } : { state: '', zip: '' };
  };

  if (parts.length >= 3) {
    const { state, zip } = parseStateZip(parts[parts.length - 1]);
    return {
      address: parts.slice(0, -2).join(', '),
      city: parts[parts.length - 2] || '',
      state,
      zip,
    };
  }

  if (parts.length === 2) {
    const { state, zip } = parseStateZip(parts[1]);
    return { address: parts[0], city: state || zip ? '' : parts[1], state, zip };
  }

  return { address: raw, city: '', state: '', zip: '' };
}

function firstText(...values: unknown[]) {
  return values.map(text).find(Boolean) || '';
}

function fieldWithAddressFallback(explicitValue: unknown, combinedAddress: unknown, key: 'address' | 'city' | 'state' | 'zip') {
  const explicit = text(explicitValue);
  const combined = text(combinedAddress);
  const parsed = splitAddress(combined);
  if (key === 'address' && explicit && explicit === combined && (parsed.city || parsed.state || parsed.zip)) {
    return parsed.address || explicit;
  }
  return firstText(explicit, parsed[key]);
}

function cityStateZip(city: unknown, state: unknown, zip: unknown) {
  const cityText = text(city);
  const stateZip = [text(state), text(zip)].filter(Boolean).join(' ');
  if (cityText && stateZip) return `${cityText}, ${stateZip}`;
  return [cityText, stateZip].filter(Boolean).join(' ');
}

function ownerName(owner?: Owner) {
  return firstText(
    owner?.owner_full_name,
    [owner?.first_name, owner?.last_name].map(text).filter(Boolean).join(' '),
    owner?.full_name,
  );
}

function wrap(value: string, max = 42) {
  if (value.length <= max) return [value];
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function wrapPdfText(value: string, max = 120) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = `${line} ${word}`.trim();
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pngDataFromUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

function mergeWithNonEmptyOverride(base: Owner, override: Owner) {
  const next = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    if (text(value)) next[key] = value;
  });
  return next;
}

function resolveOwnerPdfFields(owner: Owner, combinedAddress: string, payload: Record<string, any>, allowPayloadFallback = false): ResolvedOwnerPdfFields {
  const ownerCity = fieldWithAddressFallback(owner.city, combinedAddress, 'city');
  const ownerState = fieldWithAddressFallback(owner.state, combinedAddress, 'state');
  const ownerZip = fieldWithAddressFallback(owner.zip, combinedAddress, 'zip');

  return {
    name: ownerName(owner),
    street: fieldWithAddressFallback(owner.address, combinedAddress, 'address'),
    cityLine: cityStateZip(ownerCity, ownerState, ownerZip),
    phone: firstText(owner.phone, owner.mobile, allowPayloadFallback ? payload.cell_phone : ''),
    email: firstText(owner.email, allowPayloadFallback ? payload.business_email : ''),
    ownershipPercentage: formatOwnership(firstText(owner.ownership_percentage, owner.ownership_pct, allowPayloadFallback ? payload.ownership_pct || payload.ownership_percentage : '')),
    dob: dateValue(firstText(owner.dob_decrypted, owner.dob, allowPayloadFallback ? payload.dob : '')),
    ssn: formatFullSsn(firstText(owner.ssn_decrypted, owner.ssn, allowPayloadFallback ? payload.ssn : '')),
    driversLicense: text(owner.drivers_license),
  };
}

export function resolveLenderApplicationPdfFields(data: LenderApplicationPdfData): ResolvedLenderApplicationPdfFields {
  const payload = data.application?.application_payload || {};
  const business = data.business || {};
  const application = data.application || {};
  const deal = data.deal || {};
  const owners = data.owners || [];
  const owner1 = mergeWithNonEmptyOverride(owners[0] || {}, payload.owner1 || {});
  const owner2 = mergeWithNonEmptyOverride(owners[1] || {}, payload.owner2 || {});
  const existingAdvance = Array.isArray(payload.existing_advances) ? payload.existing_advances[0] : null;
  const businessAddress = firstText(payload.address, payload.business_address, business.address);
  const owner1Address = firstText(owner1.address, owner1.home_address, payload.home_address);
  const owner2Address = firstText(owner2.address, owner2.home_address);
  const businessCity = fieldWithAddressFallback(firstText(payload.city, business.city), businessAddress, 'city');
  const businessState = fieldWithAddressFallback(firstText(payload.state, business.state), businessAddress, 'state');
  const businessZip = fieldWithAddressFallback(firstText(payload.zip, business.zip), businessAddress, 'zip');
  const signatureDate = dateValue(application.signature_date || payload.signature_date || application.submitted_at);

  return {
    businessLegalName: firstText(payload.legal_name, payload.company_name, business.legal_name, deal.title),
    businessDba: firstText(payload.dba, business.dba),
    businessStreet: fieldWithAddressFallback(firstText(payload.address, payload.business_address, business.address), businessAddress, 'address'),
    businessCityLine: cityStateZip(businessCity, businessState, businessZip),
    businessState,
    businessZip,
    businessSuite: text(payload.suite),
    businessPhone: firstText(payload.business_phone, payload.cell_phone, business.phone),
    businessMobile: firstText(payload.business_mobile, owner1.mobile, owner1.phone, payload.cell_phone),
    businessFax: text(payload.fax),
    businessWebsite: firstText(payload.website, business.website),
    businessEmail: firstText(payload.business_email, business.email, owner1.email),
    ein: formatFullEin(firstText(payload.ein, data.ein)),
    businessStartDate: dateValue(firstText(payload.start_date, payload.business_start_date, business.start_date)),
    productsServices: firstText(payload.products_services, payload.industry, business.industry),
    posContact: [payload.pos_contact_name, payload.pos_contact_phone].filter(Boolean).join(' / '),
    posSystem: text(payload.pos_system),
    entityType: text(payload.entity_type || business.entity_type).toLowerCase(),
    merchantType: text(payload.merchant_type).toLowerCase(),
    businessLocation: text(payload.business_location).toLowerCase(),
    hasRisk: Boolean(payload.has_judgments || payload.has_tax_lien || payload.has_bankruptcy || business.has_tax_lien || business.has_bankruptcy),
    riskNotes: text(payload.notes),
    isSeasonal: Boolean(payload.is_seasonal),
    owner1: resolveOwnerPdfFields(owner1, owner1Address, payload, true),
    owner2: resolveOwnerPdfFields(owner2, owner2Address, payload),
    hasExistingAdvance: Boolean(application.has_existing_advances || payload.has_existing_advances),
    existingAdvanceFunder: text(existingAdvance?.funder_name),
    existingAdvanceOriginalAmount: money(existingAdvance?.original_amount || existingAdvance?.original_funded_amount),
    existingAdvanceBalance: money(existingAdvance?.current_balance),
    existingAdvanceDailyPayment: money(existingAdvance?.daily_payment),
    existingAdvancePaymentFrequency: text(existingAdvance?.payment_frequency),
    requestedAmount: money(deal.requested_amount || application.requested_amount || payload.requested_amount),
    useOfFunds: firstText(application.use_of_funds, payload.use_of_funds),
    desiredTimeline: firstText(application.desired_timeline, payload.timeline, payload.desired_timeline),
    averageMonthlySales: money(payload.average_monthly_sales || business.monthly_gross_revenue),
    averageVisaMcSales: money(payload.average_visa_mc_sales),
    bankName: firstText(application.bank_name, payload.bank_name),
    bankContact: text(payload.bank_contact),
    bankPhone: text(payload.bank_phone),
    accountType: firstText(application.account_type, payload.account_type),
    signer: text(application.signed_name || payload.signature || ownerName(owner1)),
    signatureDate,
    drawnSignaturePng: data.drawnSignaturePng || pngDataFromUrl(payload.signature_data_url),
  };
}

export async function generateLenderApplicationPdf(data: LenderApplicationPdfData) {
  const pdfDoc = await PDFDocument.load(await fs.readFile(templatePath), { ignoreEncryption: true });
  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdfDoc.embedJpg(await fs.readFile(logoPath));

  const fields = resolveLenderApplicationPdfFields(data);

  const draw = (value: unknown, x: number, y: number, size = 15, max = 52) => {
    const cleaned = text(value);
    if (!cleaned) return;
    wrap(cleaned, max).forEach((line, index) => {
      page.drawText(line, { x, y: y - index * (size + 2), size, font, color: rgb(0.05, 0.08, 0.12) });
    });
  };
  const check = (enabled: boolean, x: number, y: number) => {
    if (!enabled) return;
    page.drawText('X', { x, y, size: 15, font: boldFont, color: rgb(0.02, 0.09, 0.25) });
  };
  const drawReadable = (value: unknown, x: number, y: number, size = 10.5, max = 18) => {
    const cleaned = text(value);
    if (!cleaned) return;
    page.drawRectangle({ x: x - 4, y: y - 4, width: Math.max(72, Math.min(190, cleaned.length * size * 0.62 + 12)), height: size + 8, color: rgb(1, 1, 1), opacity: 0.97 });
    draw(cleaned, x, y, size, max);
  };
  const drawTemplateCorrection = (paragraph: string, x: number, y: number, width: number, height: number, size = 12, max = 170) => {
    page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), opacity: 1 });
    wrapPdfText(paragraph, max).slice(0, Math.floor(height / (size + 3))).forEach((line, index) => {
      page.drawText(line, { x: x + 4, y: y + height - size - 4 - index * (size + 3), size, font, color: rgb(0.05, 0.08, 0.12) });
    });
  };

  void logo;

  draw(fields.businessLegalName, 318, 1549, 12, 32);
  draw(fields.businessDba, 1050, 1549, 12, 24);
  draw(fields.businessStreet, 118, 1515, 12, 42);
  draw(fields.businessCityLine, 86, 1480, 12, 36);
  draw(fields.businessSuite, 925, 1515, 12, 18);
  draw(fields.businessState, 925, 1480, 12, 12);
  draw(fields.businessZip, 86, 1446, 12, 12);
  draw(fields.businessPhone, 925, 1446, 12, 20);
  draw(fields.businessMobile, 105, 1413, 12, 20);
  draw(fields.businessFax, 925, 1413, 12, 20);
  draw(fields.businessWebsite, 118, 1378, 12, 34);
  draw(fields.businessEmail, 925, 1378, 12, 34);
  drawReadable(fields.ein, 1080, 1346, 11, 18);
  draw(fields.businessStartDate, 1115, 1312, 12, 16);
  draw(fields.productsServices, 1120, 1278, 12, 22);
  draw(fields.posContact, 260, 1245, 12, 30);
  draw(fields.posSystem, 1015, 1245, 12, 24);

  check(fields.entityType.includes('corp') && !fields.entityType.includes('s_') && !fields.entityType.includes('c_'), 223, 1357);
  check(fields.entityType.includes('sole'), 326, 1357);
  check(fields.entityType.includes('llc'), 465, 1357);
  check(fields.entityType.includes('partner'), 555, 1357);

  check(fields.merchantType.includes('retail'), 195, 1324);
  check(fields.merchantType.includes('restaurant'), 305, 1324);
  check(fields.merchantType.includes('service'), 438, 1324);
  check(fields.merchantType.includes('internet'), 575, 1324);

  check(fields.businessLocation.includes('store'), 260, 1291);
  check(fields.businessLocation.includes('office'), 415, 1291);
  check(fields.businessLocation.includes('home'), 530, 1291);
  check(fields.businessLocation.includes('other'), 645, 1291);

  check(fields.hasRisk, 267, 1207);
  check(!fields.hasRisk, 335, 1207);
  draw(fields.riskNotes, 435, 1205, 12, 38);
  check(fields.isSeasonal, 1135, 1207);
  check(!fields.isSeasonal, 1210, 1207);

  const drawOwner = (owner: ResolvedOwnerPdfFields, x: number) => {
    draw(owner.name, x + 160, 906, 11.5, 32);
    draw(owner.street, x + 160, 871, 11.5, 32);
    draw(owner.cityLine, x + 225, 837, 11.5, 26);
    draw(owner.phone, x + 155, 802, 11.5, 22);
    draw(owner.email, x + 155, 768, 11, 32);
    drawReadable(owner.ownershipPercentage, x + 245, 733, 11, 10);
    drawReadable(owner.dob, x + 230, 699, 11, 16);
    drawReadable(owner.ssn, x + 155, 665, 11, 18);
    draw(owner.driversLicense, x + 210, 630, 11, 18);
  };
  drawOwner(fields.owner1, 0);
  drawOwner(fields.owner2, 755);

  check(fields.hasExistingAdvance, 465, 553);
  check(!fields.hasExistingAdvance, 575, 553);
  draw(fields.existingAdvanceFunder, 70, 508, 12, 42);
  draw(fields.existingAdvanceBalance, 1000, 541, 12, 18);
  draw(fields.requestedAmount, 975, 508, 12, 18);
  draw(fields.averageMonthlySales, 305, 458, 12, 18);
  draw(fields.averageVisaMcSales, 1040, 458, 12, 18);

  drawTemplateCorrection(
    'By signing below, the Merchant and its owners/principals: (1) certify that all information and documents submitted in connection with this Application are true, correct and complete; and (2) authorize Elite Funding Solutions, its funding partners, representatives, successors, assigns, designees, agents, partners, and funders to receive credit reports and any other information regarding the Merchant and its owners and principals from third parties.',
    70,
    318,
    1355,
    86,
    13,
    155,
  );

  if (fields.drawnSignaturePng) {
    const signatureImage = await pdfDoc.embedPng(fields.drawnSignaturePng);
    const imageDims = signatureImage.scale(1);
    const maxWidth = 260;
    const maxHeight = 52;
    const scale = Math.min(maxWidth / imageDims.width, maxHeight / imageDims.height, 1);
    page.drawImage(signatureImage, { x: 100, y: 258, width: imageDims.width * scale, height: imageDims.height * scale });
  }
  draw(fields.signer, 105, 251, 13, 28);
  draw(fields.signatureDate, 425, 251, 13, 18);
  if (fields.owner2.name) {
    draw(fields.owner2.name, 655, 251, 13, 28);
    draw(fields.signatureDate, 980, 251, 13, 18);
  }

  drawTemplateCorrection(
    'This Funding Application must include a copy of a voided check. By signing before submission, you certify that all information and documents provided are accurate, true, correct and complete. You authorize Elite Funding Solutions and its funders, partners, representatives, successors, assigns, designees, agents and affiliates to obtain information about you, your business, its owners, bank statements, processor statements, business credit reports, personal credit reports where authorized, and other information needed to review funding options. You also authorize Elite Funding Solutions to transmit this application and supporting information to its funding partners for review.',
    62,
    66,
    1380,
    128,
    10.5,
    205,
  );

  const firstPageSize = page.getSize();
  const summaryPage = pdfDoc.insertPage(0, [firstPageSize.width, firstPageSize.height]);
  const summaryMargin = 72;
  const summaryNavy = rgb(0.06, 0.17, 0.36);
  const summaryText = rgb(0.05, 0.08, 0.12);
  const summaryMuted = rgb(0.36, 0.43, 0.52);
  const summaryBorder = rgb(0.82, 0.86, 0.91);
  const summaryFill = rgb(0.96, 0.98, 1);
  let summaryY = firstPageSize.height - 84;

  const summaryValue = (value: unknown) => text(value) || 'Not provided';
  const drawSummaryText = (value: string, x: number, y: number, size: number, isBold = false, color = summaryText) => {
    summaryPage.drawText(value, { x, y, size, font: isBold ? boldFont : font, color });
  };
  const drawSummaryLines = (value: string, x: number, y: number, maxChars: number, size = 15, lineHeight = 19, color = summaryText) => {
    const lines = wrapPdfText(value, maxChars).slice(0, 3);
    lines.forEach((line, index) => {
      summaryPage.drawText(line, { x, y: y - index * lineHeight, size, font, color });
    });
    return Math.max(lineHeight, lines.length * lineHeight);
  };
  const drawSummarySection = (title: string) => {
    summaryPage.drawRectangle({ x: summaryMargin, y: summaryY - 28, width: firstPageSize.width - summaryMargin * 2, height: 34, color: summaryNavy });
    drawSummaryText(title, summaryMargin + 14, summaryY - 18, 15, true, rgb(1, 1, 1));
    summaryY -= 48;
  };
  const drawSummaryRow = (leftLabel: string, leftValue: unknown, rightLabel = '', rightValue: unknown = '') => {
    const rowTop = summaryY;
    const rowHeight = 66;
    const usableWidth = firstPageSize.width - summaryMargin * 2;
    const colWidth = usableWidth / 2;
    summaryPage.drawRectangle({ x: summaryMargin, y: rowTop - rowHeight + 8, width: usableWidth, height: rowHeight, borderColor: summaryBorder, borderWidth: 1, color: rgb(1, 1, 1) });
    summaryPage.drawLine({ start: { x: summaryMargin + colWidth, y: rowTop + 8 }, end: { x: summaryMargin + colWidth, y: rowTop - rowHeight + 8 }, thickness: 1, color: summaryBorder });
    drawSummaryText(leftLabel, summaryMargin + 14, rowTop - 14, 10.5, true, summaryMuted);
    drawSummaryLines(summaryValue(leftValue), summaryMargin + 14, rowTop - 36, 47);
    if (rightLabel) {
      drawSummaryText(rightLabel, summaryMargin + colWidth + 14, rowTop - 14, 10.5, true, summaryMuted);
      drawSummaryLines(summaryValue(rightValue), summaryMargin + colWidth + 14, rowTop - 36, 47);
    }
    summaryY -= rowHeight;
  };

  summaryPage.drawImage(logo, { x: summaryMargin, y: firstPageSize.height - 150, width: 135, height: 75 });
  drawSummaryText('Complete Application - Underwriter Review Copy', summaryMargin + 160, firstPageSize.height - 100, 25, true, summaryNavy);
  drawSummaryText('Elite Funding Solutions - clear, legible application data generated from the completed record.', summaryMargin + 160, firstPageSize.height - 128, 12.5, false, summaryMuted);
  summaryPage.drawRectangle({ x: summaryMargin, y: firstPageSize.height - 188, width: firstPageSize.width - summaryMargin * 2, height: 42, color: summaryFill, borderColor: summaryBorder, borderWidth: 1 });
  drawSummaryText('Use this first page for underwriting review. The branded application and consent pages follow in this same PDF.', summaryMargin + 18, firstPageSize.height - 164, 14, true, summaryText);
  summaryY = firstPageSize.height - 226;

  drawSummarySection('Business Information');
  drawSummaryRow('Legal business name', fields.businessLegalName, 'DBA', fields.businessDba);
  drawSummaryRow('Business address', [fields.businessStreet, fields.businessCityLine].filter(Boolean).join(', '), 'Tax ID / EIN', fields.ein);
  drawSummaryRow('Business phone', fields.businessPhone, 'Business mobile', fields.businessMobile);
  drawSummaryRow('Business email', fields.businessEmail, 'Website', fields.businessWebsite);
  drawSummaryRow('Date business started', fields.businessStartDate, 'Products / services', fields.productsServices);
  drawSummaryRow('Entity / merchant / location', [fields.entityType, fields.merchantType, fields.businessLocation].filter(Boolean).join(' / '), 'POS contact / system', [fields.posContact, fields.posSystem].filter(Boolean).join(' / '));

  drawSummarySection('Primary Owner');
  drawSummaryRow('Owner name', fields.owner1.name, 'Ownership %', fields.owner1.ownershipPercentage);
  drawSummaryRow('Home address', [fields.owner1.street, fields.owner1.cityLine].filter(Boolean).join(', '), 'Date of birth', fields.owner1.dob);
  drawSummaryRow('Owner phone', fields.owner1.phone, 'Owner email', fields.owner1.email);
  drawSummaryRow('Full SSN', fields.owner1.ssn, 'Driver license', fields.owner1.driversLicense);

  if (fields.owner2.name || fields.owner2.ssn || fields.owner2.dob) {
    drawSummarySection('Additional Owner');
    drawSummaryRow('Owner name', fields.owner2.name, 'Ownership %', fields.owner2.ownershipPercentage);
    drawSummaryRow('Home address', [fields.owner2.street, fields.owner2.cityLine].filter(Boolean).join(', '), 'Date of birth', fields.owner2.dob);
    drawSummaryRow('Owner phone', fields.owner2.phone, 'Owner email', fields.owner2.email);
    drawSummaryRow('Full SSN', fields.owner2.ssn, 'Driver license', fields.owner2.driversLicense);
  }

  drawSummarySection('Funding And Signature');
  drawSummaryRow('Requested amount', fields.requestedAmount, 'Average monthly sales', fields.averageMonthlySales);
  drawSummaryRow('Use of funds', fields.useOfFunds, 'Desired timeline', fields.desiredTimeline);
  drawSummaryRow('Average Visa/MC sales', fields.averageVisaMcSales, 'Bank / account type', [fields.bankName, fields.accountType].filter(Boolean).join(' / '));
  drawSummaryRow('Bank contact', fields.bankContact, 'Bank phone', fields.bankPhone);
  drawSummaryRow('Existing advance', fields.hasExistingAdvance ? 'Yes' : 'No', 'Existing advance funder', fields.existingAdvanceFunder);
  drawSummaryRow('Advance original amount', fields.existingAdvanceOriginalAmount, 'Advance balance', fields.existingAdvanceBalance);
  drawSummaryRow('Advance daily payment', fields.existingAdvanceDailyPayment, 'Payment frequency', fields.existingAdvancePaymentFrequency);
  drawSummaryRow('Risk / seasonal', `${fields.hasRisk ? 'Risk items reported' : 'No risk items reported'} / ${fields.isSeasonal ? 'Seasonal' : 'Not seasonal'}`, 'Risk notes', fields.riskNotes);
  drawSummaryRow('Signer', fields.signer, 'Signature date', fields.signatureDate);

  if (fields.drawnSignaturePng) {
    const summarySignatureImage = await pdfDoc.embedPng(fields.drawnSignaturePng);
    const imageDims = summarySignatureImage.scale(1);
    const scale = Math.min(300 / imageDims.width, 70 / imageDims.height, 1);
    summaryPage.drawText('Drawn signature', { x: summaryMargin + 14, y: summaryY - 10, size: 10.5, font: boldFont, color: summaryMuted });
    summaryPage.drawRectangle({ x: summaryMargin + 14, y: summaryY - 92, width: 340, height: 74, borderColor: summaryBorder, borderWidth: 1, color: rgb(1, 1, 1) });
    summaryPage.drawImage(summarySignatureImage, { x: summaryMargin + 30, y: summaryY - 84, width: imageDims.width * scale, height: imageDims.height * scale });
  }

  let disclosurePage = pdfDoc.addPage([firstPageSize.width, firstPageSize.height]);
  const disclosureMargin = 72;
  const disclosureTextColor = rgb(0.06, 0.09, 0.16);
  const disclosureNavy = rgb(0.06, 0.17, 0.36);
  let cursorY = firstPageSize.height - 86;

  const newDisclosurePage = () => {
    disclosurePage = pdfDoc.addPage([firstPageSize.width, firstPageSize.height]);
    cursorY = firstPageSize.height - 86;
  };

  const ensureSpace = (space: number) => {
    if (cursorY - space < 72) newDisclosurePage();
  };

  const drawDisclosureParagraph = (paragraph: string, size = 10.5, lineHeight = 16.5) => {
    const maxChars = Math.max(78, Math.floor((firstPageSize.width - disclosureMargin * 2) / (size * 0.47)));
    const lines = wrapPdfText(paragraph, maxChars);
    ensureSpace(lines.length * lineHeight + 8);
    lines.forEach((line) => {
      disclosurePage.drawText(line, { x: disclosureMargin, y: cursorY, size, font, color: disclosureTextColor });
      cursorY -= lineHeight;
    });
    cursorY -= 6;
  };

  disclosurePage.drawImage(logo, { x: disclosureMargin, y: firstPageSize.height - 126, width: 170, height: 95 });
  disclosurePage.drawText('Application Disclosures and Consent', { x: disclosureMargin + 205, y: firstPageSize.height - 88, size: 21, font: boldFont, color: disclosureNavy });
  disclosurePage.drawText('Elite Funding Solutions', { x: disclosureMargin + 205, y: firstPageSize.height - 115, size: 12, font: boldFont, color: disclosureTextColor });
  cursorY = firstPageSize.height - 166;
  drawDisclosureParagraph('This page is intentionally printed in dark, readable type. The applicant should be able to review these disclosures on screen, mobile, and paper before signing or submitting an application.', 11, 17);

  APPLICATION_DISCLOSURE_SECTIONS.forEach((section) => {
    ensureSpace(64);
    disclosurePage.drawText(section.title, { x: disclosureMargin, y: cursorY, size: 13.5, font: boldFont, color: disclosureNavy });
    cursorY -= 21;
    section.paragraphs.forEach((paragraph) => drawDisclosureParagraph(paragraph, 10.5, 16.5));
    cursorY -= 5;
  });

  ensureSpace(96);
  disclosurePage.drawLine({ start: { x: disclosureMargin, y: cursorY }, end: { x: firstPageSize.width - disclosureMargin, y: cursorY }, thickness: 1, color: rgb(0.78, 0.82, 0.88) });
  cursorY -= 24;
  if (fields.drawnSignaturePng) {
    const disclosureSignatureImage = await pdfDoc.embedPng(fields.drawnSignaturePng);
    const imageDims = disclosureSignatureImage.scale(1);
    const scale = Math.min(240 / imageDims.width, 44 / imageDims.height, 1);
    disclosurePage.drawImage(disclosureSignatureImage, { x: disclosureMargin, y: cursorY - 44, width: imageDims.width * scale, height: imageDims.height * scale });
    cursorY -= 52;
  }
  disclosurePage.drawText(`Applicant signature: ${fields.signer || 'Not provided'}`, { x: disclosureMargin, y: cursorY, size: 10.5, font: boldFont, color: disclosureTextColor });
  disclosurePage.drawText(`Date: ${fields.signatureDate || 'Not provided'}`, { x: firstPageSize.width - 330, y: cursorY, size: 10.5, font: boldFont, color: disclosureTextColor });

  return Buffer.from(await pdfDoc.save());
}
