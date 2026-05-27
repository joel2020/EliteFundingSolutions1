import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

function addressLine(row?: Record<string, any> | null) {
  return [row?.address, row?.city, row?.state, row?.zip].map(text).filter(Boolean).join(', ');
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
  draw(`Purpose: ${text(application.use_of_funds || payload.use_of_funds || payload.funding_purpose || 'Working capital')}`, 70, 435, 11, 78);
  draw(`Term preference: ${text(application.desired_timeline || application.desired_payment_frequency || payload.term_preference || payload.desired_timeline || 'Best available lender terms')}`, 70, 405, 11, 78);

  const signer = text(application.signed_name || payload.signature || ownerName(owner1));
  draw(signer, 105, 251, 13, 28);
  draw(dateValue(application.signature_date || payload.signature_date || application.submitted_at), 425, 251, 13, 18);
  if (ownerName(owner2)) {
    draw(ownerName(owner2), 655, 251, 13, 28);
    draw(dateValue(application.signature_date || payload.signature_date || application.submitted_at), 980, 251, 13, 18);
  }

  return Buffer.from(await pdfDoc.save());
}
