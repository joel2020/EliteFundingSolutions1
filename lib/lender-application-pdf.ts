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
  const amount = moneyNumber(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return `$${amount.toLocaleString()}`;
}

function moneyNumber(value: unknown) {
  return Number(String(value ?? '').replace(/[$,]/g, ''));
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

function wrapPdfTextByWidth(value: string, font: any, size: number, maxWidth: number) {
  const lines: string[] = [];
  const tokens = value.split(/(\s+)/).filter((token) => token.length > 0);
  let line = '';

  const pushLine = () => {
    const cleaned = line.trimEnd();
    if (cleaned) lines.push(cleaned);
    line = '';
  };

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (line && !line.endsWith(' ')) line += ' ';
      continue;
    }

    let remaining = token;
    while (remaining) {
      const prefix = line ? line : '';
      const separator = prefix && !prefix.endsWith(' ') ? ' ' : '';
      let fit = '';

      for (let index = 1; index <= remaining.length; index += 1) {
        const candidateChunk = remaining.slice(0, index);
        const candidate = `${prefix}${separator}${candidateChunk}`;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && fit) break;
        fit = candidateChunk;
      }

      if (!fit) {
        if (line) {
          pushLine();
          continue;
        }
        fit = remaining.slice(0, 1);
      }

      const candidate = `${prefix}${separator}${fit}`;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        pushLine();
        continue;
      }

      line = candidate;
      remaining = remaining.slice(fit.length);
      if (remaining) pushLine();
    }
  }
  if (line.trim()) pushLine();
  return lines;
}

function shrinkToFit(value: string, font: any, maxWidth: number, preferredSize: number, minSize = 7.2) {
  let size = preferredSize;
  while (size > minSize && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.25;
  return size;
}

function trimToFit(value: string, font: any, maxWidth: number, size: number) {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  const suffix = '...';
  let trimmed = value;
  while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}${suffix}`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed.trimEnd()}${suffix}`;
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

function normalizeExistingAdvances(payload: Record<string, any>) {
  const advances = Array.isArray(payload.existing_advances) ? payload.existing_advances : [];
  const legacyAdvance = {
    funder_name: payload.existing_advance_funder,
    current_balance: payload.existing_advance_balance,
  };

  return [...advances, legacyAdvance]
    .map((advance) => ({
      ...advance,
      funder_name: firstText(advance?.funder_name, advance?.funder, advance?.provider, advance?.company),
      current_balance: firstText(advance?.current_balance, advance?.balance, advance?.remaining_balance),
      original_amount: firstText(advance?.original_amount, advance?.original_funded_amount, advance?.funded_amount),
      daily_payment: firstText(advance?.daily_payment, advance?.payment),
      payment_frequency: firstText(advance?.payment_frequency, advance?.frequency),
    }))
    .filter((advance) => text(advance.funder_name) || text(advance.current_balance) || text(advance.original_amount) || text(advance.daily_payment))
    .slice(0, 3);
}

function existingAdvanceSummary(advances: Record<string, any>[]) {
  if (!advances.length) return '';
  return advances.map((advance, index) => {
    const funderName = text(advance.funder_name) || `Advance ${index + 1}`;
    const compactFunderName = funderName.length > 30 ? `${funderName.slice(0, 27).trimEnd()}...` : funderName;
    const details = [
      compactFunderName,
      money(advance.current_balance),
    ].filter(Boolean);
    return `${index + 1}) ${details.join(' ')}`;
  }).join('; ');
}

function existingAdvanceBalanceSummary(advances: Record<string, any>[]) {
  const balances = advances.map((advance) => moneyNumber(advance.current_balance)).filter((amount) => Number.isFinite(amount) && amount > 0);
  if (!balances.length) return '';
  if (balances.length === 1) return money(balances[0]);
  return money(balances.reduce((sum, amount) => sum + amount, 0));
}

function resolveOwnerPdfFields(owner: Owner, combinedAddress: string, payload: Record<string, any>, allowPayloadFallback = false): ResolvedOwnerPdfFields {
  const ownerCity = fieldWithAddressFallback(owner.city, combinedAddress, 'city');
  const ownerState = fieldWithAddressFallback(owner.state, combinedAddress, 'state');
  const ownerZip = fieldWithAddressFallback(owner.zip, combinedAddress, 'zip');

  return {
    name: firstText(ownerName(owner), allowPayloadFallback ? firstText(payload.full_name, payload.owner_name, payload.authorized_signer) : ''),
    street: fieldWithAddressFallback(owner.address, combinedAddress, 'address'),
    cityLine: cityStateZip(ownerCity, ownerState, ownerZip),
    phone: firstText(owner.phone, owner.mobile, allowPayloadFallback ? firstText(payload.cell_phone, payload.phone, payload.mobile) : ''),
    email: firstText(owner.email, allowPayloadFallback ? firstText(payload.email, payload.business_email) : ''),
    ownershipPercentage: formatOwnership(firstText(
      owner.ownership_pct,
      owner.ownership_percentage,
      owner.percent_ownership,
      owner.percent_of_ownership,
      allowPayloadFallback ? firstText(payload.ownership_pct, payload.ownership_percentage, payload.percent_ownership, payload.percent_of_ownership) : '',
    )),
    dob: dateValue(firstText(owner.dob_decrypted, owner.dob, owner.date_of_birth, allowPayloadFallback ? firstText(payload.dob, payload.date_of_birth, payload.owner_dob) : '')),
    ssn: formatFullSsn(firstText(owner.ssn_decrypted, owner.ssn, owner.social_security_number, owner.owner_ssn, allowPayloadFallback ? firstText(payload.ssn, payload.social_security_number, payload.owner_ssn) : '')),
    driversLicense: firstText(owner.drivers_license, owner.driver_license, owner.drivers_license_number, owner.driver_license_number, allowPayloadFallback ? firstText(payload.drivers_license, payload.driver_license, payload.owner_drivers_license, payload.driver_license_number) : ''),
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
  const existingAdvances = normalizeExistingAdvances(payload);
  const existingAdvance = existingAdvances[0] || null;
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
    hasExistingAdvance: Boolean(application.has_existing_advances || payload.has_existing_advances || existingAdvances.length),
    existingAdvanceFunder: existingAdvanceSummary(existingAdvances),
    existingAdvanceOriginalAmount: money(existingAdvance?.original_amount || existingAdvance?.original_funded_amount),
    existingAdvanceBalance: existingAdvanceBalanceSummary(existingAdvances),
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
    signer: text(application.signed_name || application.e_signature || payload.signature || ownerName(owner1)),
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
  const drawBoxText = (
    value: unknown,
    x: number,
    y: number,
    width: number,
    height: number,
    options: { size?: number; maxLines?: number; erase?: boolean; bold?: boolean } = {},
  ) => {
    const cleaned = text(value);
    if (!cleaned) return;
    const preferredSize = options.size || 11.2;
    const maxLines = options.maxLines || 1;
    const activeFont = options.bold ? boldFont : font;
    if (options.erase !== false) {
      page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), opacity: 0.98 });
    }
    if (maxLines <= 1) {
      const size = shrinkToFit(cleaned, activeFont, width - 6, preferredSize);
      const fittedText = trimToFit(cleaned, activeFont, width - 6, size);
      page.drawText(fittedText, { x: x + 3, y: y + Math.max(3, (height - size) / 2), size, font: activeFont, color: rgb(0.03, 0.07, 0.13) });
      return;
    }
    let size = preferredSize;
    let lines = wrapPdfTextByWidth(cleaned, activeFont, size, width - 6);
    while (size > 7.2 && lines.length > maxLines) {
      size -= 0.25;
      lines = wrapPdfTextByWidth(cleaned, activeFont, size, width - 6);
    }
    const lineHeight = size + 2;
    lines.slice(0, maxLines).forEach((line, index) => {
      page.drawText(line, { x: x + 3, y: y + height - size - 3 - index * lineHeight, size, font: activeFont, color: rgb(0.03, 0.07, 0.13) });
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

  drawBoxText(fields.businessLegalName, 315, 1539, 470, 28, { size: 13.5, maxLines: 2 });
  drawBoxText(fields.businessDba, 1050, 1539, 335, 28, { size: 13.2, maxLines: 2 });
  drawBoxText(fields.businessStreet, 116, 1499, 650, 30, { size: 12.2, maxLines: 2 });
  drawBoxText(fields.businessCityLine, 86, 1472, 620, 22, { size: 13.5, maxLines: 1 });
  drawBoxText(fields.businessSuite, 925, 1507, 315, 22, { size: 13.5 });
  drawBoxText(fields.businessState, 925, 1472, 145, 22, { size: 13.5 });
  drawBoxText(fields.businessZip, 86, 1438, 230, 22, { size: 13.5 });
  drawBoxText(fields.businessPhone, 925, 1438, 280, 22, { size: 13.5 });
  drawBoxText(fields.businessMobile, 105, 1405, 285, 22, { size: 13.5 });
  drawBoxText(fields.businessFax, 925, 1405, 280, 22, { size: 13.5 });
  drawBoxText(fields.businessWebsite, 118, 1367, 520, 26, { size: 11.2, maxLines: 2 });
  drawBoxText(fields.businessEmail, 925, 1367, 380, 26, { size: 11.2, maxLines: 2 });
  drawBoxText(fields.ein, 1080, 1339, 230, 24, { size: 13.5 });
  drawBoxText(fields.businessStartDate, 1115, 1305, 230, 24, { size: 13.5 });
  drawBoxText(fields.productsServices, 1120, 1264, 260, 34, { size: 12.2, maxLines: 2 });
  drawBoxText(fields.posContact, 260, 1238, 450, 24, { size: 13.5 });
  drawBoxText(fields.posSystem, 1015, 1238, 330, 24, { size: 13.5 });

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
    drawBoxText(owner.name, x + 115, 899, 560, 24, { size: 13.2 });
    drawBoxText(owner.street, x + 135, 859, 540, 30, { size: 12.2, maxLines: 2 });
    drawBoxText(owner.cityLine, x + 225, 831, 450, 24, { size: 13.2 });
    drawBoxText(owner.phone, x + 155, 796, 290, 24, { size: 13.2 });
    drawBoxText(owner.email, x + 155, 756, 410, 30, { size: 11.2, maxLines: 2 });
    drawBoxText(owner.ownershipPercentage, x + 245, 727, 150, 24, { size: 13.2 });
    drawBoxText(owner.dob, x + 230, 693, 210, 24, { size: 13.2 });
    drawBoxText(owner.ssn, x + 155, 659, 240, 24, { size: 13.2 });
    drawBoxText(owner.driversLicense, x + 210, 624, 260, 24, { size: 13.2 });
  };
  drawOwner(fields.owner1, 0);
  drawOwner(fields.owner2, 755);

  check(fields.hasExistingAdvance, 465, 553);
  check(!fields.hasExistingAdvance, 575, 553);
  drawBoxText(fields.existingAdvanceFunder, 70, 486, 665, 50, { size: 9.8, maxLines: 4 });
  drawBoxText(fields.existingAdvanceBalance, 1000, 536, 220, 22, { size: 13.2 });
  drawBoxText(fields.requestedAmount, 1082, 500, 190, 24, { size: 13.2 });
  drawBoxText(fields.averageMonthlySales, 305, 450, 230, 24, { size: 13.2 });
  drawBoxText(fields.averageVisaMcSales, 1040, 450, 230, 24, { size: 13.2 });

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
  drawBoxText(fields.signer, 105, 246, 270, 28, { size: 12.5, erase: false });
  drawBoxText(fields.signatureDate, 425, 246, 150, 28, { size: 12.5, erase: false });
  if (fields.owner2.name) {
    drawBoxText(fields.owner2.name, 655, 246, 270, 28, { size: 12.5, erase: false });
    drawBoxText(fields.signatureDate, 980, 246, 150, 28, { size: 12.5, erase: false });
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
