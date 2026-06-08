export type PartnerApplicationPayload = Record<string, any>;

function text(value: unknown) {
  return String(value ?? '').trim();
}

function firstText(...values: unknown[]) {
  return values.map(text).find(Boolean) || '';
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

function addressLine(explicit: unknown, combined: unknown) {
  const explicitText = text(explicit);
  const combinedText = text(combined);
  const parsed = splitAddress(combinedText);
  if (explicitText && explicitText === combinedText && (parsed.city || parsed.state || parsed.zip)) return parsed.address;
  return firstText(explicitText, parsed.address);
}

function addressPart(explicit: unknown, combined: unknown, key: 'city' | 'state' | 'zip') {
  return firstText(explicit, splitAddress(combined)[key]);
}

function formatOwnership(value: unknown) {
  const raw = text(value);
  if (!raw) return '';
  return raw.endsWith('%') ? raw : raw;
}

export function buildPartnerApplicationPayload(input: PartnerApplicationPayload = {}) {
  const owner1 = input.owner1 || {};
  const businessAddress = firstText(input.business_address, input.address, input.company_address, input.physical_address);
  const ownerAddress = firstText(owner1.address, owner1.home_address, input.owner_address, input.home_address);
  return {
    ...input,
    company_name: firstText(input.company_name, input.legal_name, input.business_name, input.merchant_name),
    legal_name: firstText(input.legal_name, input.company_name, input.business_name, input.merchant_name),
    dba: firstText(input.dba, input.doing_business_as),
    business_address: addressLine(businessAddress, businessAddress),
    address: addressLine(firstText(input.address, input.business_address), businessAddress),
    city: addressPart(firstText(input.city, input.business_city, input.company_city), businessAddress, 'city'),
    state: addressPart(firstText(input.state, input.business_state, input.company_state), businessAddress, 'state'),
    zip: addressPart(firstText(input.zip, input.zip_code, input.postal_code, input.business_zip, input.company_zip), businessAddress, 'zip'),
    business_phone: firstText(input.business_phone, input.phone, input.company_phone),
    business_email: firstText(input.business_email, input.email, input.company_email),
    ein: firstText(input.ein, input.tax_id, input.tax_id_ein, input.federal_tax_id, input.fein),
    start_date: firstText(input.start_date, input.business_start_date, input.date_started, input.date_business_started),
    requested_amount: firstText(input.requested_amount, input.amount_requested, input.funding_amount),
    products_services: firstText(input.products_services, input.industry, input.business_type),
    industry: firstText(input.industry, input.products_services, input.business_type),
    signature: text(input.signature || input.signed_name || input.owner_name || input.owner_full_name),
    signature_date: text(input.signature_date || input.signed_date),
    owner1: {
      ...owner1,
      first_name: firstText(owner1.first_name, input.owner_first_name),
      last_name: firstText(owner1.last_name, input.owner_last_name),
      address: addressLine(firstText(owner1.address, owner1.home_address, input.owner_address, input.home_address), ownerAddress),
      city: addressPart(firstText(owner1.city, owner1.home_city, input.owner_city, input.home_city), ownerAddress, 'city'),
      state: addressPart(firstText(owner1.state, owner1.home_state, input.owner_state, input.home_state), ownerAddress, 'state'),
      zip: addressPart(firstText(owner1.zip, owner1.home_zip, owner1.zip_code, input.owner_zip, input.home_zip, input.owner_zip_code), ownerAddress, 'zip'),
      phone: firstText(owner1.phone, owner1.mobile, input.owner_phone, input.cell_phone, input.mobile_phone),
      mobile: firstText(owner1.mobile, owner1.phone, input.owner_phone, input.cell_phone, input.mobile_phone),
      email: firstText(owner1.email, input.owner_email, input.applicant_email),
      ownership_percentage: formatOwnership(firstText(owner1.ownership_percentage, owner1.ownership_pct, owner1.owner_percentage, input.ownership_percentage, input.ownership_percent, input.ownership_pct, input.percent_ownership, input.owner_percent, input.percent_of_ownership)),
      dob: firstText(owner1.dob, owner1.date_of_birth, input.dob, input.date_of_birth, input.owner_dob, input.owner_date_of_birth),
      ssn: firstText(owner1.ssn, owner1.social_security_number, input.ssn, input.social_security_number, input.owner_ssn),
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

export function parsePartnerApplicationCsv(csv: string): PartnerApplicationPayload {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return {};

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const values = parseCsvLine(lines[1]);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  const ownerFullName = text(row.owner_name || row.owner_full_name || row.full_name || row.customer_name);
  const ownerName = splitOwnerName(ownerFullName);

  return buildPartnerApplicationPayload({
    company_name: row.company_name || row.business_name || row.legal_name || row.legal_business_name || row.merchant_name,
    legal_name: row.legal_name || row.legal_business_name || row.company_name || row.business_name || row.merchant_name,
    dba: row.dba || row.doing_business_as,
    business_address: row.business_address || row.address || row.company_address || row.physical_address,
    city: row.city || row.business_city || row.company_city,
    state: row.state || row.business_state || row.company_state,
    zip: row.zip || row.zip_code || row.postal_code || row.business_zip || row.company_zip,
    business_phone: row.business_phone || row.phone || row.company_phone,
    business_email: row.business_email || row.email || row.company_email,
    ein: row.ein || row.tax_id || row.tax_id_ein,
    start_date: row.business_start_date || row.start_date || row.date_started,
    requested_amount: row.requested_amount || row.amount_requested || row.funding_amount,
    products_services: row.industry || row.products_services || row.business_type,
    signature: row.signature || row.signed_name || row.applicant_signature || ownerFullName,
    signature_date: row.signature_date || row.signed_date || row.application_date,
    owner1: {
      first_name: row.owner_first_name || ownerName.first_name,
      last_name: row.owner_last_name || ownerName.last_name,
      address: row.owner_address || row.home_address,
      city: row.owner_city || row.home_city,
      state: row.owner_state || row.home_state,
      zip: row.owner_zip || row.home_zip,
      phone: row.owner_phone || row.cell_phone || row.mobile_phone,
      email: row.owner_email || row.email,
      ownership_percentage: row.ownership_percentage || row.ownership_pct || row.ownership_percent || row.percent_ownership || row.percent_of_ownership,
      dob: row.dob || row.date_of_birth || row.owner_dob || row.owner_date_of_birth,
      ssn: row.ssn || row.social_security_number || row.owner_ssn,
    },
  });
}
