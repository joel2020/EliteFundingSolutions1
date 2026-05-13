/*
  Production hardening for public submissions and private documents.
  - Adds contact_submissions for validated website contact requests.
  - Adds masked/encrypted sensitive field placeholders for EIN/SSN storage.
  - Ensures application document bucket remains private with 10MB upload limit.
*/

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ein_last4 text;
ALTER TABLE owners ADD COLUMN IF NOT EXISTS ssn_encrypted text;

CREATE TABLE IF NOT EXISTS contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  inquiry_type text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_org_created ON contact_submissions(organization_id, created_at DESC);
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read contact submissions" ON contact_submissions;
CREATE POLICY "Staff can read contact submissions"
  ON contact_submissions FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM user_profiles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
  ));

DROP POLICY IF EXISTS "Service role can insert contact submissions" ON contact_submissions;
CREATE POLICY "Service role can insert contact submissions"
  ON contact_submissions FOR INSERT
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('application-documents', 'application-documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/heic','image/heif'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/heic','image/heif'];
