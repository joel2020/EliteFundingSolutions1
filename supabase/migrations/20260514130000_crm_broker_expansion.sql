/*
  # CRM broker expansion

  Additive support tables for the MCA CRM redesign. Existing production tables remain
  the source of truth; these tables fill workflow gaps for deal financial snapshots,
  current positions, earnings aliases, richer notes, and activity visibility.
*/

CREATE TABLE IF NOT EXISTS deal_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  funded_date date,
  funded_amount numeric(15,2),
  total_payback numeric(15,2),
  current_balance numeric(15,2),
  percent_paid_down numeric(5,2) DEFAULT 0 CHECK (percent_paid_down >= 0 AND percent_paid_down <= 100),
  remaining_term_days integer,
  estimated_payoff_date date,
  daily_payment numeric(12,2),
  weekly_payment numeric(12,2),
  alert_flags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_financials_org ON deal_financials(organization_id);
CREATE INDEX IF NOT EXISTS idx_deal_financials_deal ON deal_financials(deal_id);
ALTER TABLE deal_financials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read deal financials" ON deal_financials;
CREATE POLICY "Staff can read deal financials"
  ON deal_financials FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Managers can manage deal financials" ON deal_financials;
CREATE POLICY "Managers can manage deal financials"
  ON deal_financials FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','processor','underwriter')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','processor','underwriter')));

CREATE TABLE IF NOT EXISTS current_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  funder_name text NOT NULL,
  original_funded_amount numeric(15,2),
  total_payback numeric(15,2),
  current_balance numeric(15,2),
  daily_payment numeric(12,2),
  weekly_payment numeric(12,2),
  payment_frequency text CHECK (payment_frequency IN ('daily','weekly','bi_weekly','monthly')),
  status text DEFAULT 'active' CHECK (status IN ('active','paid_off','defaulted','settled','unknown')),
  renewal_eligible boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_current_positions_org ON current_positions(organization_id);
CREATE INDEX IF NOT EXISTS idx_current_positions_deal ON current_positions(deal_id);
CREATE INDEX IF NOT EXISTS idx_current_positions_business ON current_positions(business_id);
ALTER TABLE current_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read current positions" ON current_positions;
CREATE POLICY "Staff can read current positions"
  ON current_positions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff can manage current positions" ON current_positions;
CREATE POLICY "Staff can manage current positions"
  ON current_positions FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','processor','underwriter','sales_rep')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','processor','underwriter','sales_rep')));

CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  commission_id uuid REFERENCES commissions(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  funding_partner_id uuid REFERENCES funding_partners(id) ON DELETE SET NULL,
  sales_rep_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  funded_amount numeric(15,2),
  commission_pct numeric(5,2) DEFAULT 0 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  gross_commission numeric(15,2) DEFAULT 0,
  net_commission numeric(15,2) DEFAULT 0,
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending','approved','paid','held','disputed')),
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_earnings_org ON earnings(organization_id);
CREATE INDEX IF NOT EXISTS idx_earnings_deal ON earnings(deal_id);
CREATE INDEX IF NOT EXISTS idx_earnings_rep ON earnings(sales_rep_id);
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read earnings" ON earnings;
CREATE POLICY "Staff can read earnings"
  ON earnings FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager'))
    OR sales_rep_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Managers can manage earnings" ON earnings;
CREATE POLICY "Managers can manage earnings"
  ON earnings FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')));

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_profile_id uuid REFERENCES user_profiles(id),
  deal_id uuid REFERENCES deals(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_deal ON activity_logs(deal_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read activity logs" ON activity_logs;
CREATE POLICY "Staff can read activity logs"
  ON activity_logs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff can insert activity logs" ON activity_logs;
CREATE POLICY "Staff can insert activity logs"
  ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id),
  owner_id uuid REFERENCES owners(id),
  body text NOT NULL,
  is_internal boolean DEFAULT true,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notes ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notes_org ON notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_notes_deal ON notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_notes_lead ON notes(lead_id);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage notes" ON notes;
CREATE POLICY "Staff can manage notes"
  ON notes FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS set_deal_financials_updated_at ON deal_financials;
CREATE TRIGGER set_deal_financials_updated_at BEFORE UPDATE ON deal_financials FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_current_positions_updated_at ON current_positions;
CREATE TRIGGER set_current_positions_updated_at BEFORE UPDATE ON current_positions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_earnings_updated_at ON earnings;
CREATE TRIGGER set_earnings_updated_at BEFORE UPDATE ON earnings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_notes_updated_at ON notes;
CREATE TRIGGER set_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
