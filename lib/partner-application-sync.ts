type RecordMap = Record<string, any>;

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function buildPartnerApplicationSyncUpdate(args: {
  existingApplicationPayload?: RecordMap | null;
  editedPayload?: RecordMap | null;
  convertedDocumentId?: string | null;
}) {
  const existingPayload = args.existingApplicationPayload || {};
  const editedPayload = args.editedPayload || {};
  const signature = text(editedPayload.signature || editedPayload.signed_name);
  const signatureDate = text(editedPayload.signature_date || editedPayload.signed_date);

  return {
    application_payload: { ...existingPayload, ...editedPayload },
    application_source: 'partner_upload',
    application_review_status: 'converted_from_partner_app',
    ...(signature ? {
      signed_name: signature,
      e_signature: signature,
      signature_type: 'partner_upload',
      signature_status: 'converted',
    } : {
      signature_status: 'pending_signature',
    }),
    ...(signatureDate ? { signature_date: signatureDate } : {}),
    ...(args.convertedDocumentId ? { signed_application_document_id: args.convertedDocumentId } : {}),
  };
}
