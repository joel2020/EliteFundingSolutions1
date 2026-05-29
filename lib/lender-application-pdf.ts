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
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-US');
}

function ownerName(owner?: Owner) {
  return [owner?.first_name, owner?.last_name].map(text).filter(Boolean).join(' ');
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

export async function generateLenderApplicationPdf(data: LenderApplicationPdfData) {
  const pdfDoc = await PDFDocument.load(await fs.readFile(templatePath), { ignoreEncryption: true });
  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdfDoc.embedJpg(await fs.readFile(logoPath));

  const payload = data.application?.application_payload || {};
  const business = data.business || {};
  const application = data.application || {};
  const deal = data.deal || {};
  const owners = data.owners || [];
  const owner1 = owners[0] || payload.owner1 || {};
  const owner2 = owners[1] || payload.owner2 || {};
  const existingAdvance = Array.isArray(payload.existing_advances) ? payload.existing_advances[0] : null;
  const hasExistingAdvance = Boolean(application.has_existing_advances || payload.has_existing_advances);
  const drawnSignaturePng = pngDataFromUrl(payload.signature_data_url);

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

  draw(business.legal_name || payload.legal_name || deal.title, 252, 1562, 14, 30);
  draw(business.dba || payload.dba, 925, 1562, 14, 30);
  draw(business.address || payload.address, 118, 1527, 14, 42);
  draw([business.city || payload.city, business.state || payload.state, business.zip || payload.zip].filter(Boolean).join(', '), 86, 1492, 14, 36);
  draw(payload.suite || '', 925, 1527, 14, 18);
  draw(business.state || payload.state, 925, 1492, 14, 12);
  draw(business.zip || payload.zip, 86, 1458, 14, 12);
  draw(business.phone || payload.business_phone, 925, 1458, 14, 20);
  draw(payload.business_mobile || owner1.mobile, 105, 1425, 14, 20);
  draw(payload.fax, 925, 1425, 14, 20);
  draw(business.website || payload.website, 118, 1390, 14, 34);
  draw(business.email || payload.business_email, 925, 1390, 14, 34);
  draw(data.ein || business.ein_last4 || payload.ein, 995, 1358, 14, 20);
  draw(dateValue(payload.start_date || business.start_date), 1010, 1324, 14, 18);
  draw(payload.products_services || business.industry || payload.industry, 995, 1290, 14, 30);
  draw([payload.pos_contact_name, payload.pos_contact_phone].filter(Boolean).join(' / '), 260, 1257, 13, 30);
  draw(payload.pos_system, 1015, 1257, 13, 24);

  const entity = text(payload.entity_type || business.entity_type).toLowerCase();
  check(entity.includes('corp') && !entity.includes('s_') && !entity.includes('c_'), 223, 1357);
  check(entity.includes('sole'), 326, 1357);
  check(entity.includes('llc'), 465, 1357);
  check(entity.includes('partner'), 555, 1357);

  const merchantType = text(payload.merchant_type).toLowerCase();
  check(merchantType.includes('retail'), 195, 1324);
  check(merchantType.includes('restaurant'), 305, 1324);
  check(merchantType.includes('service'), 438, 1324);
  check(merchantType.includes('internet'), 575, 1324);

  const location = text(payload.business_location).toLowerCase();
  check(location.includes('store'), 260, 1291);
  check(location.includes('office'), 415, 1291);
  check(location.includes('home'), 530, 1291);
  check(location.includes('other'), 645, 1291);

  const hasRisk = Boolean(payload.has_judgments || payload.has_tax_lien || payload.has_bankruptcy || business.has_tax_lien || business.has_bankruptcy);
  check(hasRisk, 267, 1207);
  check(!hasRisk, 335, 1207);
  draw(payload.notes, 435, 1205, 12, 38);
  check(Boolean(payload.is_seasonal), 1135, 1207);
  check(!payload.is_seasonal, 1210, 1207);

  const drawOwner = (owner: Owner, x: number) => {
    draw(ownerName(owner), x + 72, 884, 14, 33);
    draw(owner.address, x + 94, 849, 14, 33);
    draw([owner.city, owner.state, owner.zip].filter(Boolean).join(', '), x + 126, 815, 14, 33);
    draw(owner.phone || owner.mobile, x + 80, 780, 14, 22);
    draw(owner.email, x + 80, 746, 14, 34);
    draw(owner.ownership_percentage || owner.ownership_pct, x + 150, 711, 14, 12);
    draw(dateValue(owner.dob || owner.dob_decrypted), x + 130, 677, 14, 18);
    draw(owner.ssn || owner.ssn_decrypted || owner.ssn_last4, x + 95, 643, 14, 18);
    draw(owner.drivers_license || '', x + 190, 608, 14, 18);
  };
  drawOwner(owner1, 0);
  drawOwner(owner2, 755);

  check(hasExistingAdvance, 465, 553);
  check(!hasExistingAdvance, 575, 553);
  draw(existingAdvance?.funder_name, 70, 520, 13, 42);
  draw(money(existingAdvance?.current_balance), 1000, 553, 14, 18);
  draw(money(deal.requested_amount || application.requested_amount || payload.requested_amount), 975, 520, 14, 18);
  draw(money(payload.average_monthly_sales || business.monthly_gross_revenue), 305, 470, 14, 18);
  draw(money(payload.average_visa_mc_sales), 1040, 470, 14, 18);

  const signer = text(application.signed_name || payload.signature || ownerName(owner1));
  if (drawnSignaturePng) {
    const signatureImage = await pdfDoc.embedPng(drawnSignaturePng);
    const imageDims = signatureImage.scale(1);
    const maxWidth = 260;
    const maxHeight = 52;
    const scale = Math.min(maxWidth / imageDims.width, maxHeight / imageDims.height, 1);
    page.drawImage(signatureImage, { x: 100, y: 258, width: imageDims.width * scale, height: imageDims.height * scale });
  }
  draw(signer, 105, 251, 13, 28);
  draw(dateValue(application.signature_date || payload.signature_date || application.submitted_at), 425, 251, 13, 18);
  if (ownerName(owner2)) {
    draw(ownerName(owner2), 655, 251, 13, 28);
    draw(dateValue(application.signature_date || payload.signature_date || application.submitted_at), 980, 251, 13, 18);
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
  if (drawnSignaturePng) {
    const disclosureSignatureImage = await pdfDoc.embedPng(drawnSignaturePng);
    const imageDims = disclosureSignatureImage.scale(1);
    const scale = Math.min(240 / imageDims.width, 44 / imageDims.height, 1);
    disclosurePage.drawImage(disclosureSignatureImage, { x: disclosureMargin, y: cursorY - 44, width: imageDims.width * scale, height: imageDims.height * scale });
    cursorY -= 52;
  }
  disclosurePage.drawText(`Applicant signature: ${signer || 'Not provided'}`, { x: disclosureMargin, y: cursorY, size: 10.5, font: boldFont, color: disclosureTextColor });
  disclosurePage.drawText(`Date: ${dateValue(application.signature_date || payload.signature_date || application.submitted_at) || 'Not provided'}`, { x: firstPageSize.width - 330, y: cursorY, size: 10.5, font: boldFont, color: disclosureTextColor });

  return Buffer.from(await pdfDoc.save());
}
