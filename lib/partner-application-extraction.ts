import { PDFDocument } from 'pdf-lib';
import { buildPartnerApplicationPayload, parsePartnerApplicationCsv, type PartnerApplicationPayload } from './partner-application-fields';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function splitOwnerName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

async function extractPdfFormPayload(bytes: Buffer) {
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    const values: Record<string, string> = {};
    form.getFields().forEach((field) => {
      const name = normalizeKey(field.getName());
      const value = text((field as any).getText?.() ?? (field as any).getSelected?.()?.join?.(', ') ?? (field as any).isChecked?.());
      if (value && value !== 'false') values[name] = value;
    });
    if (!Object.keys(values).length) return {};
    const ownerName = text(values.owner_name || values.principal_name || values.applicant_name || values.authorized_signer);
    const ownerParts = splitOwnerName(ownerName);
    return buildPartnerApplicationPayload({
      company_name: values.company_name || values.business_name || values.legal_business_name || values.merchant_name,
      legal_name: values.legal_name || values.legal_business_name || values.business_name || values.company_name || values.merchant_name,
      dba: values.dba || values.doing_business_as,
      business_address: values.business_address || values.company_address || values.physical_address || values.address,
      city: values.business_city || values.city,
      state: values.business_state || values.state,
      zip: values.business_zip || values.zip || values.zip_code,
      business_phone: values.business_phone || values.company_phone || values.phone,
      business_email: values.business_email || values.company_email || values.email,
      ein: values.ein || values.tax_id || values.federal_tax_id,
      start_date: values.business_start_date || values.start_date || values.date_business_started,
      requested_amount: values.requested_amount || values.amount_requested || values.funding_amount,
      products_services: values.products_services || values.industry || values.business_type,
      signature: values.signature || values.applicant_signature || values.signed_name || ownerName,
      signature_date: values.signature_date || values.signed_date || values.date_signed || values.application_date,
      owner1: {
        first_name: values.owner_first_name || ownerParts.first_name,
        last_name: values.owner_last_name || ownerParts.last_name,
        address: values.owner_address || values.home_address,
        city: values.owner_city || values.home_city,
        state: values.owner_state || values.home_state,
        zip: values.owner_zip || values.home_zip,
        phone: values.owner_phone || values.cell_phone || values.mobile_phone,
        email: values.owner_email || values.applicant_email || values.email,
        ownership_percentage: values.ownership_percentage || values.ownership_percent || values.ownership,
        dob: values.dob || values.date_of_birth,
        ssn: values.ssn || values.social_security_number,
      },
    });
  } catch {
    return {};
  }
}

export async function extractPartnerApplicationPayloadFromUpload({
  fileName,
  mimeType,
  bytes,
  fallback,
}: {
  fileName: string;
  mimeType?: string | null;
  bytes: Buffer;
  fallback: PartnerApplicationPayload;
}) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (extension === 'csv' || mimeType === 'text/csv' || mimeType === 'application/csv') {
    return parsePartnerApplicationCsv(bytes.toString('utf8'));
  }

  if (extension === 'pdf' || mimeType === 'application/pdf') {
    const formPayload = await extractPdfFormPayload(bytes);
    return buildPartnerApplicationPayload({
      ...fallback,
      ...formPayload,
      signature_data_url: (formPayload as any).signature_data_url || (fallback as any).signature_data_url || '',
      extraction_note: Object.keys(formPayload).length
        ? 'PDF form fields were extracted automatically. Review/edit fields before sending if the original partner form had unusual formatting.'
        : 'PDF uploaded and converted from current CRM fields. Review/edit fields if the partner file has newer details.',
    });
  }

  return buildPartnerApplicationPayload(fallback);
}
