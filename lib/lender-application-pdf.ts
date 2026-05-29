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
  existingAdvanceBalance: string;
  requestedAmount: string;
  averageMonthlySales: string;
  averageVisaMcSales: string;
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

function formatSsn(value: unknown) {
  const digits = digitsOnly(value);
  if (digits.length !== 9) return text(value);
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
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
    owner?.full_name,
    owner?.owner_full_name,
    [owner?.first_name, owner?.last_name].map(text).filter(Boolean).join(' '),
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

function resolveOwnerPdfFields(owner: Owner, combinedAddress: string, payload: Record<string, any>): ResolvedOwnerPdfFields {
  const ownerCity = fieldWithAddressFallback(owner.city, combinedAddress, 'city');
  const ownerState = fieldWithAddressFallback(owner.state, combinedAddress, 'state');
  const ownerZip = fieldWithAddressFallback(owner.zip, combinedAddress, 'zip');

  return {
    name: ownerName(owner),
    street: fieldWithAddressFallback(owner.address, combinedAddress, 'address'),
    cityLine: cityStateZip(ownerCity, ownerState, ownerZip),
    phone: firstText(owner.phone, owner.mobile, payload.cell_phone),
    email: firstText(owner.email, payload.business_email),
    ownershipPercentage: text(owner.ownership_percentage || owner.ownership_pct),
    dob: dateValue(owner.dob || owner.dob_decrypted),
    ssn: formatSsn(owner.ssn || owner.ssn_decrypted || owner.ssn_last4),
    driversLicense: text(owner.drivers_license),
  };
}

export function resolveLenderApplicationPdfFields(data: LenderApplicationPdfData): ResolvedLenderApplicationPdfFields {
  const payload = data.application?.application_payload || {};
  const business = data.business || {};
  const application = data.application || {};
  const deal = data.deal || {};
  const owners = data.owners || [];
  const owner1 = owners[0] || payload.owner1 || {};
  const owner2 = owners[1] || payload.owner2 || {};
  const existingAdvance = Array.isArray(payload.existing_advances) ? payload.existing_advances[0] : null;
  const businessAddress = firstText(business.address, payload.address, payload.business_address);
  const owner1Address = firstText(owner1.address, owner1.home_address, payload.home_address);
  const owner2Address = firstText(owner2.address, owner2.home_address);
  const businessCity = fieldWithAddressFallback(firstText(business.city, payload.city), businessAddress, 'city');
  const businessState = fieldWithAddressFallback(firstText(business.state, payload.state), businessAddress, 'state');
  const businessZip = fieldWithAddressFallback(firstText(business.zip, payload.zip), businessAddress, 'zip');
  const signatureDate = dateValue(application.signature_date || payload.signature_date || application.submitted_at);

  return {
    businessLegalName: firstText(business.legal_name, payload.legal_name, payload.company_name, deal.title),
    businessDba: firstText(business.dba, payload.dba),
    businessStreet: fieldWithAddressFallback(firstText(business.address, payload.address), businessAddress, 'address'),
    businessCityLine: cityStateZip(businessCity, businessState, businessZip),
    businessState,
    businessZip,
    businessSuite: text(payload.suite),
    businessPhone: firstText(business.phone, payload.business_phone, payload.cell_phone),
    businessMobile: firstText(payload.business_mobile, owner1.mobile, owner1.phone, payload.cell_phone),
    businessFax: text(payload.fax),
    businessWebsite: firstText(business.website, payload.website),
    businessEmail: firstText(business.email, payload.business_email, owner1.email),
    ein: formatEin(data.ein || business.ein_last4 || payload.ein),
    businessStartDate: dateValue(firstText(payload.start_date, payload.business_start_date, business.start_date)),
    productsServices: firstText(payload.products_services, business.industry, payload.industry),
    posContact: [payload.pos_contact_name, payload.pos_contact_phone].filter(Boolean).join(' / '),
    posSystem: text(payload.pos_system),
    entityType: text(payload.entity_type || business.entity_type).toLowerCase(),
    merchantType: text(payload.merchant_type).toLowerCase(),
    businessLocation: text(payload.business_location).toLowerCase(),
    hasRisk: Boolean(payload.has_judgments || payload.has_tax_lien || payload.has_bankruptcy || business.has_tax_lien || business.has_bankruptcy),
    riskNotes: text(payload.notes),
    isSeasonal: Boolean(payload.is_seasonal),
    owner1: resolveOwnerPdfFields(owner1, owner1Address, payload),
    owner2: resolveOwnerPdfFields(owner2, owner2Address, payload),
    hasExistingAdvance: Boolean(application.has_existing_advances || payload.has_existing_advances),
    existingAdvanceFunder: text(existingAdvance?.funder_name),
    existingAdvanceBalance: money(existingAdvance?.current_balance),
    requestedAmount: money(deal.requested_amount || application.requested_amount || payload.requested_amount),
    averageMonthlySales: money(payload.average_monthly_sales || business.monthly_gross_revenue),
    averageVisaMcSales: money(payload.average_visa_mc_sales),
    signer: text(application.signed_name || payload.signature || ownerName(owner1)),
    signatureDate,
    drawnSignaturePng: pngDataFromUrl(payload.signature_data_url),
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

  page.drawRectangle({ x: 58, y: 1660, width: 420, height: 250, color: rgb(1, 1, 1) });
  page.drawImage(logo, { x: 72, y: 1710, width: 340, height: 191 });

  draw(fields.businessLegalName, 252, 1562, 14, 30);
  draw(fields.businessDba, 925, 1562, 14, 30);
  draw(fields.businessStreet, 118, 1527, 14, 42);
  draw(fields.businessCityLine, 86, 1492, 14, 36);
  draw(fields.businessSuite, 925, 1527, 14, 18);
  draw(fields.businessState, 925, 1492, 14, 12);
  draw(fields.businessZip, 86, 1458, 14, 12);
  draw(fields.businessPhone, 925, 1458, 14, 20);
  draw(fields.businessMobile, 105, 1425, 14, 20);
  draw(fields.businessFax, 925, 1425, 14, 20);
  draw(fields.businessWebsite, 118, 1390, 14, 34);
  draw(fields.businessEmail, 925, 1390, 14, 34);
  draw(fields.ein, 995, 1358, 14, 20);
  draw(fields.businessStartDate, 1010, 1324, 14, 18);
  draw(fields.productsServices, 995, 1290, 14, 30);
  draw(fields.posContact, 260, 1257, 13, 30);
  draw(fields.posSystem, 1015, 1257, 13, 24);

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
    draw(owner.name, x + 72, 884, 14, 33);
    draw(owner.street, x + 94, 849, 14, 33);
    draw(owner.cityLine, x + 126, 815, 14, 33);
    draw(owner.phone, x + 80, 780, 14, 22);
    draw(owner.email, x + 80, 746, 14, 34);
    draw(owner.ownershipPercentage, x + 150, 711, 14, 12);
    draw(owner.dob, x + 130, 677, 14, 18);
    draw(owner.ssn, x + 95, 643, 14, 18);
    draw(owner.driversLicense, x + 190, 608, 14, 18);
  };
  drawOwner(fields.owner1, 0);
  drawOwner(fields.owner2, 755);

  check(fields.hasExistingAdvance, 465, 553);
  check(!fields.hasExistingAdvance, 575, 553);
  draw(fields.existingAdvanceFunder, 70, 520, 13, 42);
  draw(fields.existingAdvanceBalance, 1000, 553, 14, 18);
  draw(fields.requestedAmount, 975, 520, 14, 18);
  draw(fields.averageMonthlySales, 305, 470, 14, 18);
  draw(fields.averageVisaMcSales, 1040, 470, 14, 18);

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

  const firstPageSize = page.getSize();
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
