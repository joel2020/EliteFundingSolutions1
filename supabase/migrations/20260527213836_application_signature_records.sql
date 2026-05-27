/*
  Signed application hardening:
  - Explicit signature status/version fields on applications
  - Immutable application_signatures ledger for E-SIGN evidence
  - Trigger guard to prevent changing signed application evidence without marking re-sign required
*/

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS signature_status text NOT NULL DEFAULT 'unsigned'
    CHECK (signature_status IN ('unsigned','signed','requires_resign','voided')),
  ADD COLUMN IF NOT EXISTS signature_type text
    CHECK (signature_type IS NULL OR signature_type IN ('typed','drawn')),
  ADD COLUMN IF NOT EXISTS signature_data_storage_path text,
  ADD COLUMN IF NOT EXISTS disclosure_acceptance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS application_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS signed_application_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_signature_status
  ON public.applications (organization_id, signature_status, signed_at DESC);

CREATE TABLE IF NOT EXISTS public.application_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  signature_status text NOT NULL DEFAULT 'signed'
    CHECK (signature_status IN ('signed','voided','requires_resign')),
  signature_type text NOT NULL DEFAULT 'typed'
    CHECK (signature_type IN ('typed','drawn')),
  signature_name text NOT NULL,
  signature_date date,
  signed_at timestamptz NOT NULL DEFAULT now(),
  signature_ip text,
  signature_user_agent text,
  consent_version text,
  application_version integer NOT NULL DEFAULT 1,
  disclosure_acceptance jsonb NOT NULL DEFAULT '{}'::jsonb,
  application_payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_signatures_application
  ON public.application_signatures (organization_id, application_id, signed_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_signatures_deal
  ON public.application_signatures (organization_id, deal_id, signed_at DESC);

ALTER TABLE public.application_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read application signatures" ON public.application_signatures;
CREATE POLICY "Staff can read application signatures"
  ON public.application_signatures FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Service role can manage application signatures" ON public.application_signatures;
CREATE POLICY "Service role can manage application signatures"
  ON public.application_signatures FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.prevent_signed_application_evidence_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.signature_status = 'signed'
    AND NEW.signature_status = 'signed'
    AND (
      NEW.application_payload IS DISTINCT FROM OLD.application_payload
      OR NEW.e_signature IS DISTINCT FROM OLD.e_signature
      OR NEW.signed_name IS DISTINCT FROM OLD.signed_name
      OR NEW.signature_date IS DISTINCT FROM OLD.signature_date
      OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
      OR NEW.signer_ip IS DISTINCT FROM OLD.signer_ip
      OR NEW.signer_user_agent IS DISTINCT FROM OLD.signer_user_agent
      OR NEW.consent_version IS DISTINCT FROM OLD.consent_version
      OR NEW.disclosure_acceptance IS DISTINCT FROM OLD.disclosure_acceptance
      OR NEW.application_version IS DISTINCT FROM OLD.application_version
    )
  THEN
    RAISE EXCEPTION 'Signed application evidence is locked. Mark signature_status requires_resign before changing signed evidence.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_signed_application_evidence_update ON public.applications;
CREATE TRIGGER prevent_signed_application_evidence_update
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_signed_application_evidence_update();

COMMENT ON TABLE public.application_signatures IS 'Immutable signed application evidence ledger for website and portal E-SIGN submissions.';
COMMENT ON COLUMN public.applications.signature_status IS 'Unsigned, signed, requires_resign, or voided state for application evidence.';
COMMENT ON COLUMN public.applications.signed_application_document_id IS 'Generated completed/signed application PDF attached to the CRM deal documents.';
