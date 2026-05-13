/*
  # Final production hardening for public submissions and private documents

  Ensures all tables/columns used by the public application/contact routes exist,
  persists API rate limits in Supabase, keeps application documents private, and
  avoids direct authenticated reads from the application-documents storage bucket.
*/

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS ein_encrypted text,
  ADD COLUMN IF NOT EXISTS ein_last4 text;

ALTER TABLE owners
  ADD COLUMN IF NOT EXISTS dob_encrypted text,
  ADD COLUMN IF NOT EXISTS ssn_encrypted text,
  ADD COLUMN IF NOT EXISTS ssn_last4 text;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS application_payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS certification_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_authorization_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS esign_consent_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS authorization_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS e_signature text,
  ADD COLUMN IF NOT EXISTS signed_name text,
  ADD COLUMN IF NOT EXISTS signature_date date,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signer_ip text,
  ADD COLUMN IF NOT EXISTS signer_user_agent text,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_businesses_ein_last4 ON businesses(ein_last4);
CREATE INDEX IF NOT EXISTS idx_owners_ssn_last4 ON owners(ssn_last4);
CREATE INDEX IF NOT EXISTS idx_applications_payload_gin ON applications USING gin (application_payload);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON applications(submitted_at DESC);

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
      AND is_active = true
      AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
  ));

DROP POLICY IF EXISTS "Service role can insert contact submissions" ON contact_submissions;
CREATE POLICY "Service role can insert contact submissions"
  ON contact_submissions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage rate limits" ON rate_limits;
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('application-documents', 'application-documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/heic','image/heif'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','image/heic','image/heif'];

DROP POLICY IF EXISTS "Staff can read application documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload application documents" ON storage.objects;
DROP POLICY IF EXISTS "Active CRM users can upload org application documents" ON storage.objects;
DROP POLICY IF EXISTS "Active CRM users can delete org application documents" ON storage.objects;

-- No SELECT policy is intentionally created for application-documents. CRM access
-- must go through app/api/documents/[id]/signed-url, which validates auth/org and
-- audit-logs each short-lived signed URL.
CREATE POLICY "Active CRM users can upload org application documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'application-documents'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.is_active = true
        AND (storage.foldername(name))[1] = up.organization_id::text
    )
  );

CREATE POLICY "Active CRM users can delete org application documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'application-documents'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.is_active = true
        AND (storage.foldername(name))[1] = up.organization_id::text
    )
  );

REVOKE EXECUTE ON FUNCTION public.log_sensitive_field_reveal(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_field_reveal(uuid, text, text) FROM authenticated;
