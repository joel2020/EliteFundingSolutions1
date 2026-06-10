/*
  # Application signature evidence fields

  The public application signs in two steps: first the CRM application record is
  created, then the drawn signature PNG and completed Elite application PDF are
  stored. These columns make that second step explicit so funder package
  readiness can require real signed-application evidence instead of only a
  typed name/date.
*/

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS signature_status text DEFAULT 'pending_signature',
  ADD COLUMN IF NOT EXISTS signature_type text,
  ADD COLUMN IF NOT EXISTS signature_data_storage_path text,
  ADD COLUMN IF NOT EXISTS signed_application_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disclosure_acceptance jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_applications_signature_status ON applications(signature_status);
CREATE INDEX IF NOT EXISTS idx_applications_signed_application_document_id ON applications(signed_application_document_id);

COMMENT ON COLUMN applications.signature_status IS 'Signature lifecycle status; signed means a drawn/stored signature or reviewed signature evidence completed the application.';
COMMENT ON COLUMN applications.signature_type IS 'Signature capture method, such as drawn, typed, or partner_upload.';
COMMENT ON COLUMN applications.signature_data_storage_path IS 'Private storage path for the drawn signature image used on generated applications.';
COMMENT ON COLUMN applications.signed_application_document_id IS 'Document row for the completed signed Elite Funding Solutions application PDF.';
COMMENT ON COLUMN applications.disclosure_acceptance IS 'Structured disclosure, consent, and checkbox acceptance snapshot captured with signature.';
