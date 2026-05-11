/*
  # Leads, Businesses, and Owners Schema - Phase 2

  ## Overview
  Creates the core CRM entities for capturing business and owner data.

  ## New Tables
  1. `leads` - Initial lead capture records
  2. `businesses` - Business entity profiles
  3. `owners` - Individual owner profiles
  4. `business_owners` - Junction: one business many owners, one owner many businesses

  ## Security
  - RLS on all tables scoped to organization_id
  - Sales reps can see assigned leads
  - Admins/managers can see all org leads
*/

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  lead_source text NOT NULL DEFAULT 'website'
    CHECK (lead_source IN ('website','referral','broker','iso','paid_ads','organic_search','cold_email','partner','manual_entry')),
  campaign text,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  business_name text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','qualified','application_started','converted','lost','unresponsive')),
  assigned_user_id uuid REFERENCES user_profiles(id),
  notes text,
  tags text[] DEFAULT '{}',
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  updated_by uuid REFERENCES user_profiles(id),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select leads in org"
  ON leads FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','underwriter','processor','viewer')
    )
    OR
    assigned_user_id IN (
      SELECT id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep')
    )
  );

CREATE POLICY "Staff can update leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep')
    )
    OR assigned_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep')
    )
    OR assigned_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );

-- ============================================================
-- BUSINESSES
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  legal_name text NOT NULL,
  dba text,
  entity_type text CHECK (entity_type IN ('sole_proprietor','llc','s_corp','c_corp','partnership','non_profit','other')),
  ein_encrypted text,
  industry text,
  naics_code text,
  start_date date,
  phone text,
  email text,
  website text,
  address text,
  city text,
  state text,
  zip text,
  monthly_gross_revenue numeric(15,2),
  average_daily_balance numeric(15,2),
  deposit_count_monthly integer,
  current_processor text,
  landlord_name text,
  landlord_phone text,
  rent_amount numeric(10,2),
  has_tax_lien boolean DEFAULT false,
  has_bankruptcy boolean DEFAULT false,
  risk_flags text[] DEFAULT '{}',
  notes text,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  updated_by uuid REFERENCES user_profiles(id),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_businesses_org ON businesses(organization_id);
CREATE INDEX IF NOT EXISTS idx_businesses_created ON businesses(created_at);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can select businesses in org"
  ON businesses FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert businesses"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

CREATE POLICY "Staff can update businesses"
  ON businesses FOR UPDATE
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

-- ============================================================
-- OWNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid REFERENCES auth.users(id),
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  dob_encrypted text,
  ssn_last4 text,
  ownership_percentage numeric(5,2) CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
  credit_score_range text CHECK (credit_score_range IN ('below_500','500_549','550_599','600_649','650_699','700_749','750_plus')),
  address text,
  city text,
  state text,
  zip text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id),
  updated_by uuid REFERENCES user_profiles(id),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_owners_org ON owners(organization_id);
CREATE INDEX IF NOT EXISTS idx_owners_email ON owners(email);
CREATE INDEX IF NOT EXISTS idx_owners_user_id ON owners(user_id);

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can select owners in org"
  ON owners FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Staff can insert owners"
  ON owners FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Staff and owners can update owners"
  ON owners FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

-- ============================================================
-- BUSINESS_OWNERS (junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS business_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  ownership_percentage numeric(5,2) CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_business_owners_business ON business_owners(business_id);
CREATE INDEX IF NOT EXISTS idx_business_owners_owner ON business_owners(owner_id);

ALTER TABLE business_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage business_owners in org"
  ON business_owners FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert business_owners"
  ON business_owners FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

-- Updated_at triggers
CREATE TRIGGER set_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_owners_updated_at BEFORE UPDATE ON owners FOR EACH ROW EXECUTE FUNCTION set_updated_at();
