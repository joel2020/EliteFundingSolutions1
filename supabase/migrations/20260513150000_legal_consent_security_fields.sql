/*
  # Legal consent and sensitive-data security fields

  Adds explicit consent capture fields required for the public application,
  records signer attribution for E-SIGN evidence, keeps RLS enabled, and
  stores audit entries for sensitive-field access events.
*/

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS certification_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_authorization_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS esign_consent_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signed_name text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signer_ip text,
  ADD COLUMN IF NOT EXISTS signer_user_agent text,
  ADD COLUMN IF NOT EXISTS consent_version text;

CREATE INDEX IF NOT EXISTS idx_applications_consent_version ON applications(consent_version);
CREATE INDEX IF NOT EXISTS idx_applications_signed_at ON applications(signed_at);

COMMENT ON COLUMN applications.certification_accepted IS 'Applicant certified that submitted information and documents are accurate, true, correct, and complete.';
COMMENT ON COLUMN applications.credit_authorization_accepted IS 'Applicant authorized consumer, personal, business, investigative, credit, bank, processor, and financial reports.';
COMMENT ON COLUMN applications.esign_consent_accepted IS 'Applicant consented to electronic records and electronic signatures.';
COMMENT ON COLUMN applications.sms_consent_accepted IS 'Applicant gave clear affirmative SMS/text consent with STOP opt-out disclosure.';
COMMENT ON COLUMN applications.terms_accepted IS 'Applicant accepted website/application legal terms and disclosures.';
COMMENT ON COLUMN applications.privacy_policy_accepted IS 'Applicant accepted privacy policy disclosures.';
COMMENT ON COLUMN applications.signed_name IS 'Typed signer name captured for E-SIGN evidence.';
COMMENT ON COLUMN applications.signed_at IS 'Server timestamp for signed application submission.';
COMMENT ON COLUMN applications.signer_ip IS 'IP address captured with the application signature.';
COMMENT ON COLUMN applications.signer_user_agent IS 'User agent captured with the application signature.';
COMMENT ON COLUMN applications.consent_version IS 'Version identifier for authorization, privacy, SMS, and E-SIGN consent language.';

CREATE OR REPLACE FUNCTION public.log_sensitive_field_reveal(
  p_application_id uuid,
  p_field_name text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile.id IS NULL OR v_profile.role NOT IN ('super_admin','admin') THEN
    RAISE EXCEPTION 'Only Super Admin/Admin can reveal sensitive fields';
  END IF;

  INSERT INTO activity_logs (
    organization_id,
    application_id,
    user_profile_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    v_profile.organization_id,
    p_application_id,
    v_profile.id,
    'sensitive_field_revealed',
    'applications',
    p_application_id,
    jsonb_build_object('field_name', p_field_name, 'reason', p_reason, 'revealed_at', now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_sensitive_field_reveal(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_sensitive_field_reveal(uuid, text, text) TO authenticated;
