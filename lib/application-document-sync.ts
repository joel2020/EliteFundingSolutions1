type RecordMap = Record<string, any>;

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function buildCompletedApplicationDocumentSyncUpdate(args: {
  existingApplicationPayload?: RecordMap | null;
  editedPayload?: RecordMap | null;
  completedDocumentId: string;
  reviewStatus?: string;
  existingSignatureStatus?: string | null;
}) {
  const existingPayload = args.existingApplicationPayload || {};
  const editedPayload = args.editedPayload || {};
  const mergedPayload = { ...existingPayload, ...editedPayload };

  // Signed applications have locked evidence + payload (DB trigger). On a re-send, only relink the
  // freshly generated document and review status — never rewrite the signed evidence.
  if (String(args.existingSignatureStatus || '').toLowerCase() === 'signed') {
    return {
      application_review_status: args.reviewStatus || 'submitted',
      signed_application_document_id: args.completedDocumentId,
    };
  }

  const signature = text(
    editedPayload.signature ||
    editedPayload.signed_name ||
    mergedPayload.signature ||
    mergedPayload.signed_name
  );
  const signatureDate = text(
    editedPayload.signature_date ||
    editedPayload.signed_date ||
    mergedPayload.signature_date ||
    mergedPayload.signed_date
  );

  return {
    application_payload: mergedPayload,
    application_review_status: args.reviewStatus || 'submitted',
    signed_application_document_id: args.completedDocumentId,
    ...(signature ? {
      signed_name: signature,
      e_signature: signature,
      signature_status: 'signed',
    } : {}),
    ...(signatureDate ? { signature_date: signatureDate } : {}),
  };
}
