/*
  # Applications, Deals, Pipeline Stages, and Deal History - Phase 3

  ## Overview
  Creates the deal lifecycle: application intake → fundable deal opportunity.

  ## New Tables
  1. `pipeline_stages` - Configurable pipeline stages
  2. `applications` - Submitted funding intake forms
  3. `existing_advances` - Current advance obligations on an application
  4. `deals` - Fundable opportunity derived from application
  5. `deal_status_history` - Immutable stage change log for reporting
  6. `activities` - User-facing timeline events per record

  ## Security
  - RLS on all tables scoped to organization_id
  - Clients can only see their own application/deal
*/

-- ============================================================
-- PIPELINE STAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  slug text NOT NULL,
  color text DEFAULT '#2563EB',
  position integer NOT NULL DEFAULT 0,
  is_terminal boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, slug)
);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read pipeline stages"
  ON pipeline_stages FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage pipeline stages"
  ON pipeline_stages FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')
    )
  );

-- Seed default pipeline stages
INSERT INTO pipeline_stages (organization_id, name, slug, color, position) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Lead Captured', 'lead_captured', '#A1A1AA', 0),
  ('00000000-0000-0000-0000-000000000001', 'Application Started', 'application_started', '#F59E0B', 1),
  ('00000000-0000-0000-0000-000000000001', 'Application Submitted', 'application_submitted', '#2563EB', 2),
  ('00000000-0000-0000-0000-000000000001', 'Documents Requested', 'documents_requested', '#F59E0B', 3),
  ('00000000-0000-0000-0000-000000000001', 'Documents Received', 'documents_received', '#2563EB', 4),
  ('00000000-0000-0000-0000-000000000001', 'Underwriting Review', 'underwriting_review', '#8B5CF6', 5),
  ('00000000-0000-0000-0000-000000000001', 'Submitted to Partners', 'submitted_to_partners', '#2563EB', 6),
  ('00000000-0000-0000-0000-000000000001', 'Offers Received', 'offers_received', '#10B981', 7),
  ('00000000-0000-0000-0000-000000000001', 'Offer Presented', 'offer_presented', '#10B981', 8),
  ('00000000-0000-0000-0000-000000000001', 'Contract Sent', 'contract_sent', '#F59E0B', 9),
  ('00000000-0000-0000-0000-000000000001', 'Contract Signed', 'contract_signed', '#10B981', 10),
  ('00000000-0000-0000-0000-000000000001', 'Funded', 'funded', '#10B981', 11),
  ('00000000-0000-0000-0000-000000000001', 'Renewal Eligible', 'renewal_eligible', '#2563EB', 12),
  ('00000000-0000-0000-0000-000000000001', 'Declined', 'declined', '#EF4444', 13),
  ('00000000-0000-0000-0000-000000000001', 'Lost / Unresponsive', 'lost_unresponsive', '#A1A1AA', 14)
ON CONFLICT (organization_id, slug) DO NOTHING;

-- ============================================================
-- APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid REFERENCES businesses(id),
  lead_id uuid REFERENCES leads(id),
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN ('started','submitted','under_review','approved','declined','withdrawn')),

  -- Funding request
  requested_amount numeric(15,2),
  use_of_funds text,
  desired_timeline text,
  has_existing_advances boolean DEFAULT false,
  desired_payment_frequency text CHECK (desired_payment_frequency IN ('daily','weekly','bi_weekly','monthly')),
  notes text,

  -- Bank info (store partial only)
  bank_name text,
  account_type text CHECK (account_type IN ('checking','savings')),
  routing_number text,
  account_last4 text,
  avg_monthly_deposits numeric(15,2),
  negative_days_count integer DEFAULT 0,
  nsf_count integer DEFAULT 0,
  ending_balance_estimate numeric(15,2),

  submitted_at timestamptz,
  ip_address text,
  user_agent text,

  assigned_user_id uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  updated_by uuid REFERENCES user_profiles(id),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_applications_org ON applications(organization_id);
CREATE INDEX IF NOT EXISTS idx_applications_business ON applications(business_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at);

ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read applications in org"
  ON applications FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','underwriter','processor','viewer')
    )
    OR assigned_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    OR business_id IN (
      SELECT b.id FROM businesses b
      JOIN business_owners bo ON bo.business_id = b.id
      JOIN owners o ON o.id = bo.owner_id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff and clients can insert applications"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update applications"
  ON applications FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
    OR assigned_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
    OR assigned_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );

-- Also allow unauthenticated inserts for public application form
CREATE POLICY "Public can insert applications"
  ON applications FOR INSERT
  TO anon
  WITH CHECK (organization_id = '00000000-0000-0000-0000-000000000001');

-- ============================================================
-- EXISTING ADVANCES (on an application)
-- ============================================================
CREATE TABLE IF NOT EXISTS existing_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  funder_name text,
  original_funded_amount numeric(15,2),
  current_balance numeric(15,2),
  daily_payment numeric(10,2),
  weekly_payment numeric(10,2),
  payment_frequency text CHECK (payment_frequency IN ('daily','weekly','bi_weekly')),
  renewal_eligible boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_existing_advances_app ON existing_advances(application_id);

ALTER TABLE existing_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage existing advances"
  ON existing_advances FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert existing advances"
  ON existing_advances FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anon can insert existing advances"
  ON existing_advances FOR INSERT
  TO anon
  WITH CHECK (organization_id = '00000000-0000-0000-0000-000000000001');

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  application_id uuid REFERENCES applications(id),
  business_id uuid REFERENCES businesses(id),
  lead_id uuid REFERENCES leads(id),
  stage_id uuid REFERENCES pipeline_stages(id),
  stage_slug text DEFAULT 'lead_captured',
  title text,
  requested_amount numeric(15,2),
  approved_amount numeric(15,2),
  funded_amount numeric(15,2),
  funding_probability integer DEFAULT 50 CHECK (funding_probability >= 0 AND funding_probability <= 100),
  assigned_user_id uuid REFERENCES user_profiles(id),
  funded_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  notes text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  updated_by uuid REFERENCES user_profiles(id),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_deals_org ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_application ON deals(application_id);
CREATE INDEX IF NOT EXISTS idx_deals_business ON deals(business_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned ON deals(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_slug);
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals(created_at);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read deals in org"
  ON deals FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','underwriter','processor','viewer')
    )
    OR assigned_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    OR business_id IN (
      SELECT b.id FROM businesses b
      JOIN business_owners bo ON bo.business_id = b.id
      JOIN owners o ON o.id = bo.owner_id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert deals"
  ON deals FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep')
    )
  );

CREATE POLICY "Staff can update deals"
  ON deals FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
    OR assigned_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
    OR assigned_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );

-- ============================================================
-- DEAL STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_by uuid REFERENCES user_profiles(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_status_history_deal ON deal_status_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_status_history_org ON deal_status_history(organization_id);

ALTER TABLE deal_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read deal history in org"
  ON deal_status_history FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert deal history"
  ON deal_status_history FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- ACTIVITIES (user-facing timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id),
  application_id uuid REFERENCES applications(id),
  business_id uuid REFERENCES businesses(id),
  owner_id uuid REFERENCES owners(id),
  lead_id uuid REFERENCES leads(id),
  activity_type text NOT NULL
    CHECK (activity_type IN ('note','call','email','sms','status_change','document_event','task','assignment','system')),
  title text NOT NULL,
  body text,
  direction text CHECK (direction IN ('inbound','outbound','internal')),
  performed_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_application ON activities(application_id);
CREATE INDEX IF NOT EXISTS idx_activities_business ON activities(business_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read activities in org"
  ON activities FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER set_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
