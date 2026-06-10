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

function ownerPayload(input: PartnerApplicationPayload, owner: PartnerApplicationPayload, prefix: string) {
  const ownerAddress = firstText(
    owner.address,
    owner.home_address,
    input[`${prefix}_address`],
    input[`${prefix}_home_address`],
    prefix === 'owner1' ? input.owner_address : '',
    prefix === 'owner1' ? input.home_address : '',
  );

  return {
    ...owner,
    first_name: firstText(owner.first_name, input[`${prefix}_first_name`]),
    last_name: firstText(owner.last_name, input[`${prefix}_last_name`]),
    address: addressLine(firstText(owner.address, owner.home_address, input[`${prefix}_address`], input[`${prefix}_home_address`], prefix === 'owner1' ? input.owner_address : '', prefix === 'owner1' ? input.home_address : ''), ownerAddress),
    city: addressPart(firstText(owner.city, owner.home_city, input[`${prefix}_city`], input[`${prefix}_home_city`], prefix === 'owner1' ? input.owner_city : '', prefix === 'owner1' ? input.home_city : ''), ownerAddress, 'city'),
    state: addressPart(firstText(owner.state, owner.home_state, input[`${prefix}_state`], input[`${prefix}_home_state`], prefix === 'owner1' ? input.owner_state : '', prefix === 'owner1' ? input.home_state : ''), ownerAddress, 'state'),
    zip: addressPart(firstText(owner.zip, owner.home_zip, owner.zip_code, input[`${prefix}_zip`], input[`${prefix}_home_zip`], input[`${prefix}_zip_code`], prefix === 'owner1' ? input.owner_zip : '', prefix === 'owner1' ? input.home_zip : '', prefix === 'owner1' ? input.owner_zip_code : ''), ownerAddress, 'zip'),
    phone: firstText(owner.phone, owner.mobile, input[`${prefix}_phone`], input[`${prefix}_cell_phone`], input[`${prefix}_mobile_phone`], prefix === 'owner1' ? input.owner_phone : '', prefix === 'owner1' ? input.cell_phone : '', prefix === 'owner1' ? input.mobile_phone : ''),
    mobile: firstText(owner.mobile, owner.phone, input[`${prefix}_mobile`], input[`${prefix}_phone`], input[`${prefix}_cell_phone`], input[`${prefix}_mobile_phone`], prefix === 'owner1' ? input.owner_phone : '', prefix === 'owner1' ? input.cell_phone : '', prefix === 'owner1' ? input.mobile_phone : ''),
    email: firstText(owner.email, input[`${prefix}_email`], prefix === 'owner1' ? input.owner_email : '', prefix === 'owner1' ? input.applicant_email : ''),
    ownership_percentage: formatOwnership(firstText(owner.ownership_percentage, owner.ownership_pct, owner.owner_percentage, input[`${prefix}_ownership_percentage`], input[`${prefix}_ownership_percent`], input[`${prefix}_ownership_pct`], input[`${prefix}_percent_ownership`], prefix === 'owner1' ? input.ownership_percentage : '', prefix === 'owner1' ? input.ownership_percent : '', prefix === 'owner1' ? input.ownership_pct : '', prefix === 'owner1' ? input.percent_ownership : '', prefix === 'owner1' ? input.owner_percent : '', prefix === 'owner1' ? input.percent_of_ownership : '')),
    dob: firstText(owner.dob, owner.date_of_birth, input[`${prefix}_dob`], input[`${prefix}_date_of_birth`], prefix === 'owner1' ? input.dob : '', prefix === 'owner1' ? input.date_of_birth : '', prefix === 'owner1' ? input.owner_dob : '', prefix === 'owner1' ? input.owner_date_of_birth : ''),
    ssn: firstText(owner.ssn, owner.social_security_number, input[`${prefix}_ssn`], input[`${prefix}_social_security_number`], prefix === 'owner1' ? input.ssn : '', prefix === 'owner1' ? input.social_security_number : '', prefix === 'owner1' ? input.owner_ssn : ''),
  };
}

function normalizeExistingAdvances(input: PartnerApplicationPayload) {
  const advances = Array.isArray(input.existing_advances) ? input.existing_advances : [];
  const aliases = [
    {
      funder_name: firstText(input.existing_advance_funder, input.open_advance_funder, input.current_funder),
      current_balance: firstText(input.existing_advance_balance, input.open_advance_balance, input.current_balance),
    },
    {
      funder_name: firstText(input.existing_advance_2_funder, input.open_advance_2_funder, input.current_funder_2),
      current_balance: firstText(input.existing_advance_2_balance, input.open_advance_2_balance, input.current_balance_2),
    },
    {
      funder_name: firstText(input.existing_advance_3_funder, input.open_advance_3_funder, input.current_funder_3),
      current_balance: firstText(input.existing_advance_3_balance, input.open_advance_3_balance, input.current_balance_3),
    },
  ];

  return [...advances, ...aliases]
    .map((advance) => ({
      funder_name: firstText(advance?.funder_name, advance?.funder, advance?.provider, advance?.company),
      original_amount: firstText(advance?.original_amount, advance?.original_funded_amount, advance?.funded_amount),
      current_balance: firstText(advance?.current_balance, advance?.balance, advance?.remaining_balance),
      daily_payment: firstText(advance?.daily_payment, advance?.payment),
      payment_frequency: firstText(advance?.payment_frequency, advance?.frequency),
      notes: text(advance?.notes),
    }))
    .filter((advance) => advance.funder_name || advance.current_balance || advance.original_amount || advance.daily_payment)
    .slice(0, 3);
}

export function buildPartnerApplicationPayload(input: PartnerApplicationPayload = {}) {
  const owner1 = input.owner1 || {};
  const owner2 = input.owner2 || {};
  const businessAddress = firstText(input.business_address, input.address, input.company_address, input.physical_address);
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
    owner1: ownerPayload(input, owner1, 'owner1'),
    owner2: ownerPayload(input, owner2, 'owner2'),
    has_existing_advances: Boolean(input.has_existing_advances || normalizeExistingAdvances(input).length),
    existing_advances: normalizeExistingAdvances(input),
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
    owner2: {
      first_name: row.owner2_first_name || row.co_owner_first_name,
      last_name: row.owner2_last_name || row.co_owner_last_name,
      address: row.owner2_address || row.co_owner_address || row.co_owner_home_address,
      city: row.owner2_city || row.co_owner_city,
      state: row.owner2_state || row.co_owner_state,
      zip: row.owner2_zip || row.co_owner_zip,
      phone: row.owner2_phone || row.co_owner_phone || row.co_owner_cell_phone,
      email: row.owner2_email || row.co_owner_email,
      ownership_percentage: row.owner2_ownership_percentage || row.owner2_percent_ownership || row.co_owner_ownership_percentage || row.co_owner_percent_ownership,
      dob: row.owner2_dob || row.owner2_date_of_birth || row.co_owner_dob || row.co_owner_date_of_birth,
      ssn: row.owner2_ssn || row.co_owner_ssn,
    },
    existing_advance_funder: row.existing_advance_funder || row.open_advance_funder || row.current_funder,
    existing_advance_balance: row.existing_advance_balance || row.open_advance_balance || row.current_balance,
    existing_advance_2_funder: row.existing_advance_2_funder || row.open_advance_2_funder || row.current_funder_2,
    existing_advance_2_balance: row.existing_advance_2_balance || row.open_advance_2_balance || row.current_balance_2,
    existing_advance_3_funder: row.existing_advance_3_funder || row.open_advance_3_funder || row.current_funder_3,
    existing_advance_3_balance: row.existing_advance_3_balance || row.open_advance_3_balance || row.current_balance_3,
  });
}
