/*
  # CRM operating system guardrails

  Additive fields for MCA deal intelligence, state disclosure tracking, funder
  matching, and ISO quality operations. These fields support UI enforcement and
  reporting without changing existing RLS ownership boundaries.
*/

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS underwriting_score integer CHECK (underwriting_score IS NULL OR (underwriting_score >= 0 AND underwriting_score <= 100)),
  ADD COLUMN IF NOT EXISTS risk_tier text CHECK (risk_tier IS NULL OR risk_tier IN ('A','B','C','D','decline')),
  ADD COLUMN IF NOT EXISTS missing_documents text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS compliance_status text DEFAULT 'not_checked'
    CHECK (compliance_status IN ('not_checked','clear','blocked','waived')),
  ADD COLUMN IF NOT EXISTS compliance_blockers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS disclosure_state text,
  ADD COLUMN IF NOT EXISTS disclosure_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS disclosure_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disclosure_version text,
  ADD COLUMN IF NOT EXISTS best_funding_partner_id uuid REFERENCES funding_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS best_next_action text,
  ADD COLUMN IF NOT EXISTS ai_summary text;

ALTER TABLE funding_partners
  ADD COLUMN IF NOT EXISTS max_existing_positions integer,
  ADD COLUMN IF NOT EXISTS max_negative_days integer,
  ADD COLUMN IF NOT EXISTS max_nsf_count integer,
  ADD COLUMN IF NOT EXISTS preferred_submission_method text
    CHECK (preferred_submission_method IS NULL OR preferred_submission_method IN ('email','portal','api','manual')),
  ADD COLUMN IF NOT EXISTS criteria_notes text;

ALTER TABLE renewals
  ADD COLUMN IF NOT EXISTS days_since_funding integer,
  ADD COLUMN IF NOT EXISTS renewal_probability integer CHECK (renewal_probability IS NULL OR (renewal_probability >= 0 AND renewal_probability <= 100)),
  ADD COLUMN IF NOT EXISTS alert_flags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS bank_refresh_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_contacted_at timestamptz;

ALTER TABLE iso_brokers
  ADD COLUMN IF NOT EXISTS portal_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS default_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS funded_volume numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score integer CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  ADD COLUMN IF NOT EXISTS missing_doc_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS fraud_flag_count integer DEFAULT 0;

CREATE TABLE IF NOT EXISTS deal_compliance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  state text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','satisfied','waived','blocked')),
  details jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_compliance_events_org ON deal_compliance_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_deal_compliance_events_deal ON deal_compliance_events(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_compliance_events_status ON deal_compliance_events(status);

ALTER TABLE deal_compliance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read compliance events" ON deal_compliance_events;
CREATE POLICY "Staff can read compliance events"
  ON deal_compliance_events FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','processor','underwriter')
    )
  );

DROP POLICY IF EXISTS "Managers can insert compliance events" ON deal_compliance_events;
CREATE POLICY "Managers can insert compliance events"
  ON deal_compliance_events FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','processor','underwriter')
    )
  );
