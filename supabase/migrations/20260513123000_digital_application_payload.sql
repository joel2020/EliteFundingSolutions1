/*
  # Digital PDF application payload support

  Stores the complete digitized Elite Funding Solution Application PDF payload,
  authorization flags, e-signature, and signature date on the CRM application
  record so staff can review every submitted field immediately.
*/

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS application_payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS authorization_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS e_signature text,
  ADD COLUMN IF NOT EXISTS signature_date date;

CREATE INDEX IF NOT EXISTS idx_applications_payload_gin ON applications USING gin (application_payload);
CREATE INDEX IF NOT EXISTS idx_applications_signature_date ON applications(signature_date);

COMMENT ON COLUMN applications.application_payload IS 'Complete digital application payload mapped from Elite Funding Solution Application.pdf, with sensitive account number reduced to last four digits.';
COMMENT ON COLUMN applications.authorization_consent IS 'Required credit/background authorization consent from the digital PDF application.';
COMMENT ON COLUMN applications.sms_consent IS 'Optional SMS consent from the digital PDF application.';
COMMENT ON COLUMN applications.e_signature IS 'Typed e-signature captured before submission.';
COMMENT ON COLUMN applications.signature_date IS 'Date associated with the typed e-signature.';
