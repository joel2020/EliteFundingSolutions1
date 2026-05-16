/*
  ISO broker application links and CRM routing foundations.

  Broker/ISO records get stable application slugs for URLs like
  /apply/iso/acme-capital. Public submissions can attach back to the broker.
  This also adds the data fields needed for closer routing, lender packaging,
  deal history, default tracking, and finance split attribution.
*/

ALTER TABLE public.iso_brokers
  ADD COLUMN IF NOT EXISTS application_slug text;

UPDATE public.iso_brokers
SET application_slug = lower(trim(both '-' from regexp_replace(
  concat_ws('-', nullif(company_name, ''), nullif(broker_name, ''), left(id::text, 8)),
  '[^a-zA-Z0-9]+',
  '-',
  'g'
)))
WHERE application_slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_iso_brokers_application_slug
  ON public.iso_brokers (organization_id, application_slug)
  WHERE application_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_iso_brokers_application_lookup
  ON public.iso_brokers (application_slug)
  WHERE application_slug IS NOT NULL AND is_active = true;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS iso_broker_id uuid REFERENCES public.iso_brokers(id),
  ADD COLUMN IF NOT EXISTS lead_source text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS iso_broker_id uuid REFERENCES public.iso_brokers(id);

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS iso_broker_id uuid REFERENCES public.iso_brokers(id),
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS junior_closer_id uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS senior_closer_id uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS submission_sequence integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duplicate_of_business_id uuid REFERENCES public.businesses(id),
  ADD COLUMN IF NOT EXISTS defaulted_at timestamptz,
  ADD COLUMN IF NOT EXISTS default_reason text,
  ADD COLUMN IF NOT EXISTS commission_clawback_amount numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_partner_commission_pct numeric(5,2) DEFAULT 20 CHECK (referral_partner_commission_pct >= 0 AND referral_partner_commission_pct <= 100),
  ADD COLUMN IF NOT EXISTS junior_closer_commission_pct numeric(5,2) DEFAULT 5 CHECK (junior_closer_commission_pct >= 0 AND junior_closer_commission_pct <= 100),
  ADD COLUMN IF NOT EXISTS senior_closer_commission_pct numeric(5,2) DEFAULT 10 CHECK (senior_closer_commission_pct >= 0 AND senior_closer_commission_pct <= 100);

CREATE INDEX IF NOT EXISTS idx_applications_iso_broker
  ON public.applications (iso_broker_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_iso_broker
  ON public.leads (iso_broker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_iso_broker
  ON public.deals (iso_broker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_closers
  ON public.deals (junior_closer_id, senior_closer_id);

CREATE INDEX IF NOT EXISTS idx_deals_business_sequence
  ON public.deals (business_id, submission_sequence);

ALTER TABLE public.partner_submissions
  ADD COLUMN IF NOT EXISTS custom_message text,
  ADD COLUMN IF NOT EXISTS attachment_document_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS generated_email_body text;

CREATE TABLE IF NOT EXISTS public.deal_lender_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  business_id uuid REFERENCES public.businesses(id),
  deal_id uuid REFERENCES public.deals(id),
  funding_partner_id uuid REFERENCES public.funding_partners(id),
  outcome text NOT NULL DEFAULT 'submitted'
    CHECK (outcome IN ('submitted','approved','declined','funded','paid_off','defaulted','clawback')),
  funded_amount numeric(15,2),
  defaulted_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_lender_outcomes_business_partner
  ON public.deal_lender_outcomes (business_id, funding_partner_id, outcome);

ALTER TABLE public.deal_lender_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read deal lender outcomes in org"
  ON public.deal_lender_outcomes FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  );

CREATE POLICY "Staff can insert deal lender outcomes"
  ON public.deal_lender_outcomes FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  );

CREATE POLICY "Staff can update deal lender outcomes"
  ON public.deal_lender_outcomes FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','processor','underwriter')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','processor','underwriter')
    )
  );

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.document_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%document_type%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.document_requests DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.document_requests
  ADD CONSTRAINT document_requests_document_type_check
  CHECK (document_type IN (
    'bank_statement','bank_statements','license_verification','drivers_license','driver_license',
    'owner_id_verification','voided_check','business_tax_returns','processing_statements',
    'proof_of_ownership','signed_application','completed_application','contract','signed_contract',
    'proof_of_address','business_verification','advance_statements','payoff_letter',
    'final_bank_verification','final_owner_id_verification','funding_amount_confirmed',
    'payment_frequency_confirmed','approved_offer','accepted_offer','stips_satisfied',
    'stipulation','other','owner_name','cell_phone','business_legal_name','requested_amount',
    'ein','ssn'
  ));
