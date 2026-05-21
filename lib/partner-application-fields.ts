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
