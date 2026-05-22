export type PartnerApplicationPayload = Record<string, any>;

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function buildPartnerApplicationPayload(input: PartnerApplicationPayload = {}) {
  const owner1 = input.owner1 || {};
  return {
    ...input,
    company_name: text(input.company_name || input.legal_name),
    legal_name: text(input.legal_name || input.company_name),
    dba: text(input.dba),
    business_address: text(input.business_address || input.address),
    address: text(input.address || input.business_address),
    city: text(input.city),
    state: text(input.state),
    zip: text(input.zip),
    business_phone: text(input.business_phone || input.phone),
    business_email: text(input.business_email || input.email),
    ein: text(input.ein),
    start_date: text(input.start_date),
    requested_amount: text(input.requested_amount),
    products_services: text(input.products_services || input.industry),
    industry: text(input.industry || input.products_services),
    owner1: {
      ...owner1,
      first_name: text(owner1.first_name),
      last_name: text(owner1.last_name),
      address: text(owner1.address),
      city: text(owner1.city),
      state: text(owner1.state),
      zip: text(owner1.zip),
      phone: text(owner1.phone || owner1.mobile),
      mobile: text(owner1.mobile || owner1.phone),
      email: text(owner1.email),
      ownership_percentage: text(owner1.ownership_percentage || owner1.ownership_pct),
      dob: text(owner1.dob),
      ssn: text(owner1.ssn),
    },
  };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function splitOwnerName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

export function parsePartnerApplicationCsv(csv: string) {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return {};

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const values = parseCsvLine(lines[1]);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  const ownerFullName = text(row.owner_name || row.owner_full_name || row.full_name || row.customer_name);
  const ownerName = splitOwnerName(ownerFullName);

  return buildPartnerApplicationPayload({
    company_name: row.company_name || row.business_name || row.legal_name || row.merchant_name,
    legal_name: row.legal_name || row.company_name || row.business_name || row.merchant_name,
    dba: row.dba || row.doing_business_as,
    business_address: row.business_address || row.address || row.company_address,
    city: row.city || row.business_city,
    state: row.state || row.business_state,
    zip: row.zip || row.zip_code || row.business_zip,
    business_phone: row.business_phone || row.phone || row.company_phone,
    business_email: row.business_email || row.email || row.company_email,
    ein: row.ein || row.tax_id || row.tax_id_ein,
    start_date: row.business_start_date || row.start_date || row.date_started,
    requested_amount: row.requested_amount || row.amount_requested || row.funding_amount,
    products_services: row.industry || row.products_services || row.business_type,
    owner1: {
      first_name: row.owner_first_name || ownerName.first_name,
      last_name: row.owner_last_name || ownerName.last_name,
      address: row.owner_address || row.home_address,
      city: row.owner_city || row.home_city,
      state: row.owner_state || row.home_state,
      zip: row.owner_zip || row.home_zip,
      phone: row.owner_phone || row.cell_phone || row.mobile_phone,
      email: row.owner_email || row.email,
      ownership_percentage: row.ownership_percentage || row.ownership_pct,
      dob: row.dob || row.date_of_birth,
      ssn: row.ssn || row.social_security_number,
    },
  });
}
