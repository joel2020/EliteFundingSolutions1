/*
  # Underwriting, Funding Partners, Offers, and Stipulations - Phase 5

  ## Overview
  Creates the underwriting queue, partner management, offer tracking, and stipulations.

  ## New Tables
  1. `underwriting_reviews` - Underwriting analysis per deal
  2. `funding_partners` - Funder directory
  3. `partner_submissions` - Deal submitted to a specific partner
  4. `offers` - Offer received from a partner
  5. `stipulations` - Stip requirements per offer

  ## Security
  - Underwriters, admins, managers can access underwriting data
  - ISO brokers can only see deals they submitted
*/

-- ============================================================
-- UNDERWRITING REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS underwriting_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  application_id uuid REFERENCES applications(id),
  assigned_underwriter_id uuid REFERENCES user_profiles(id),

  -- Input data
  monthly_gross_revenue numeric(15,2),
  average_daily_balance numeric(15,2),
  deposit_count integer,
  nsf_count integer DEFAULT 0,
  negative_days integer DEFAULT 0,
  existing_advance_balance numeric(15,2) DEFAULT 0,
  existing_daily_payments numeric(10,2) DEFAULT 0,
  industry text,
  time_in_business_months integer,
  credit_score_range text,
  has_tax_lien boolean DEFAULT false,
  has_bankruptcy boolean DEFAULT false,
  document_completeness_pct integer DEFAULT 0,

  -- Calculated outputs
  estimated_funding_min numeric(15,2),
  estimated_funding_max numeric(15,2),
  max_safe_payment_daily numeric(10,2),
  estimated_factor_rate numeric(6,4),
  estimated_payback_amount numeric(15,2),
  estimated_daily_payment numeric(10,2),
  estimated_weekly_payment numeric(10,2),
  existing_payment_burden_pct numeric(5,2),
  risk_tier text CHECK (risk_tier IN ('A','B','C','D','decline')),
  underwriting_score integer CHECK (underwriting_score >= 0 AND underwriting_score <= 100),
  renewal_eligible boolean DEFAULT false,
  risk_flags text[] DEFAULT '{}',

  notes text,
  decision text CHECK (decision IN ('approved','approved_modified','declined','more_info_needed','pending')),
  decision_at timestamptz,
  decision_by uuid REFERENCES user_profiles(id),
  decision_notes text,

  status text DEFAULT 'pending' CHECK (status IN ('pending','in_review','completed','on_hold')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  updated_by uuid REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_uw_reviews_org ON underwriting_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_uw_reviews_deal ON underwriting_reviews(deal_id);
CREATE INDEX IF NOT EXISTS idx_uw_reviews_status ON underwriting_reviews(status);

ALTER TABLE underwriting_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Underwriters can read reviews in org"
  ON underwriting_reviews FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','underwriter','processor')
    )
  );

CREATE POLICY "Underwriters can insert reviews"
  ON underwriting_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','underwriter')
    )
  );

CREATE POLICY "Underwriters can update reviews"
  ON underwriting_reviews FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','underwriter')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','underwriter')
    )
  );

-- ============================================================
-- FUNDING PARTNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS funding_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  submission_email text,
  portal_url text,
  product_types text[] DEFAULT '{}',
  min_funding_amount numeric(15,2),
  max_funding_amount numeric(15,2),
  min_monthly_revenue numeric(15,2),
  min_time_in_business_months integer,
  min_credit_score integer,
  restricted_industries text[] DEFAULT '{}',
  states_served text[] DEFAULT '{}',
  avg_approval_days integer,
  commission_rules jsonb DEFAULT '{}',
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_funding_partners_org ON funding_partners(organization_id);

ALTER TABLE funding_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read funding partners in org"
  ON funding_partners FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage funding partners"
  ON funding_partners FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')
    )
  );

CREATE POLICY "Admins can update funding partners"
  ON funding_partners FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')
    )
  );

-- Seed funding partners
INSERT INTO funding_partners (organization_id, name, contact_name, email, min_funding_amount, max_funding_amount, min_monthly_revenue, avg_approval_days, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Rapid Capital Funding', 'James Torres', 'james@rapidcapital.com', 5000, 500000, 10000, 2, true),
  ('00000000-0000-0000-0000-000000000001', 'Apex Business Funding', 'Sarah Chen', 'sarah@apexbiz.com', 10000, 1000000, 15000, 3, true),
  ('00000000-0000-0000-0000-000000000001', 'Cornerstone Merchant Advance', 'Mike Davis', 'mdavis@cornerstone.com', 5000, 250000, 8000, 1, true),
  ('00000000-0000-0000-0000-000000000001', 'Summit Capital Group', 'Lisa Park', 'lpark@summitcg.com', 25000, 2000000, 25000, 4, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PARTNER SUBMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS partner_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  funding_partner_id uuid NOT NULL REFERENCES funding_partners(id),
  submitted_by uuid REFERENCES user_profiles(id),
  submitted_at timestamptz,
  status text DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','in_review','approved','declined','more_info_needed','withdrawn')),
  decline_reason text,
  response_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_submissions_org ON partner_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_partner_submissions_deal ON partner_submissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_partner_submissions_partner ON partner_submissions(funding_partner_id);

ALTER TABLE partner_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read submissions in org"
  ON partner_submissions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  );

CREATE POLICY "Staff can insert submissions"
  ON partner_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

CREATE POLICY "Staff can update submissions"
  ON partner_submissions FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

-- ============================================================
-- OFFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  partner_submission_id uuid REFERENCES partner_submissions(id),
  funding_partner_id uuid REFERENCES funding_partners(id),

  approved_amount numeric(15,2) NOT NULL CHECK (approved_amount > 0),
  buy_rate numeric(6,4),
  sell_rate numeric(6,4),
  factor_rate numeric(6,4),
  payback_amount numeric(15,2),
  term_days integer,
  payment_frequency text CHECK (payment_frequency IN ('daily','weekly','bi_weekly')),
  daily_payment numeric(10,2),
  weekly_payment numeric(10,2),
  origination_fee numeric(10,2) DEFAULT 0,
  broker_commission_pct numeric(5,2) DEFAULT 0,
  iso_commission_pct numeric(5,2) DEFAULT 0,
  net_funding_amount numeric(15,2),
  holdback_pct numeric(5,2),

  stips_required text[] DEFAULT '{}',
  expires_at date,
  status text DEFAULT 'received'
    CHECK (status IN ('received','presented','accepted','rejected','expired','withdrawn')),
  presented_at timestamptz,
  accepted_at timestamptz,
  notes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_offers_org ON offers(organization_id);
CREATE INDEX IF NOT EXISTS idx_offers_deal ON offers(deal_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read offers in org"
  ON offers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','underwriter','processor')
    )
    OR deal_id IN (
      SELECT d.id FROM deals d
      JOIN businesses b ON b.id = d.business_id
      JOIN business_owners bo ON bo.business_id = b.id
      JOIN owners o ON o.id = bo.owner_id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

CREATE POLICY "Staff can update offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

-- ============================================================
-- STIPULATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS stipulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id),
  offer_id uuid REFERENCES offers(id),
  name text NOT NULL,
  required_by_partner text,
  due_date date,
  status text DEFAULT 'needed'
    CHECK (status IN ('needed','requested','received','approved','rejected','waived')),
  assigned_user_id uuid REFERENCES user_profiles(id),
  document_id uuid REFERENCES documents(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stipulations_org ON stipulations(organization_id);
CREATE INDEX IF NOT EXISTS idx_stipulations_deal ON stipulations(deal_id);
CREATE INDEX IF NOT EXISTS idx_stipulations_offer ON stipulations(offer_id);

ALTER TABLE stipulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage stipulations in org"
  ON stipulations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert stipulations"
  ON stipulations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

CREATE POLICY "Staff can update stipulations"
  ON stipulations FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  );

-- Triggers
CREATE TRIGGER set_uw_reviews_updated_at BEFORE UPDATE ON underwriting_reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_funding_partners_updated_at BEFORE UPDATE ON funding_partners FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_partner_submissions_updated_at BEFORE UPDATE ON partner_submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_offers_updated_at BEFORE UPDATE ON offers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_stipulations_updated_at BEFORE UPDATE ON stipulations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
