/*
  # Secure public application intake hardening

  Adds encrypted storage columns for sensitive applicant fields and creates a
  private document bucket used by the server-side application submission API.
*/

ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS ssn_encrypted text;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS routing_number_encrypted text;

CREATE INDEX IF NOT EXISTS idx_applications_org_status_created
  ON applications(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_businesses_org_legal_name
  ON businesses(organization_id, legal_name);

CREATE INDEX IF NOT EXISTS idx_leads_org_status_created
  ON leads(organization_id, status, created_at DESC);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-documents',
  'application-documents',
  false,
  26214400,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'];

CREATE POLICY "Staff can read application documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can upload application documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'application-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  );
