/*
  # Contracts, Renewals, ISO Brokers, Commissions, Messages - Phase 6

  ## Overview
  Completes the deal lifecycle with contracts, renewals, commissions, and messaging.

  ## New Tables
  1. `contracts` - Contract lifecycle per deal/offer
  2. `renewals` - Renewal pipeline
  3. `iso_brokers` - ISO/broker records
  4. `commissions` - Commission tracking per funded deal
  5. `messages` - Internal and client-facing messaging
  6. `appointments` - Meeting/appointment scheduling
*/

-- ============================================================
-- CONTRACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid NOT NULL REFERENCES deals(id),
  offer_id uuid REFERENCES offers(id),
  contract_type text DEFAULT 'mca' CHECK (contract_type IN ('mca','term_loan','line_of_credit','other')),
  sent_date timestamptz,
  signed_date timestamptz,
  status text DEFAULT 'draft'
    CHECK (status IN ('draft','sent','viewed','signed','rejected','expired','funded')),
  storage_path text,
  signed_storage_path text,
  funding_date date,
  funded_amount numeric(15,2),
  notes text,
  docusign_envelope_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_contracts_org ON contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_deal ON contracts(deal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read contracts in org"
  ON contracts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
    OR deal_id IN (
      SELECT d.id FROM deals d
      JOIN businesses b ON b.id = d.business_id
      JOIN business_owners bo ON bo.business_id = b.id
      JOIN owners o ON o.id = bo.owner_id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert contracts"
  ON contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

CREATE POLICY "Staff can update contracts"
  ON contracts FOR UPDATE
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
-- RENEWALS
-- ============================================================
CREATE TABLE IF NOT EXISTS renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  original_deal_id uuid NOT NULL REFERENCES deals(id),
  new_deal_id uuid REFERENCES deals(id),
  business_id uuid REFERENCES businesses(id),
  original_funded_amount numeric(15,2),
  current_balance numeric(15,2),
  payback_remaining numeric(15,2),
  percent_paid_down numeric(5,2),
  estimated_renewal_amount numeric(15,2),
  status text DEFAULT 'not_eligible'
    CHECK (status IN ('not_eligible','eligible_soon','eligible','contacted','application_updated','submitted','funded','declined')),
  renewal_date date,
  assigned_user_id uuid REFERENCES user_profiles(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renewals_org ON renewals(organization_id);
CREATE INDEX IF NOT EXISTS idx_renewals_deal ON renewals(original_deal_id);
CREATE INDEX IF NOT EXISTS idx_renewals_status ON renewals(status);

ALTER TABLE renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read renewals in org"
  ON renewals FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

CREATE POLICY "Staff can insert renewals"
  ON renewals FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep')
    )
  );

CREATE POLICY "Staff can update renewals"
  ON renewals FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep')
    )
  );

-- ============================================================
-- ISO BROKERS
-- ============================================================
CREATE TABLE IF NOT EXISTS iso_brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  company_name text NOT NULL,
  broker_name text,
  email text,
  phone text,
  commission_pct numeric(5,2) DEFAULT 0 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  payment_terms text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iso_brokers_org ON iso_brokers(organization_id);

ALTER TABLE iso_brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read iso brokers in org"
  ON iso_brokers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep')
    )
  );

CREATE POLICY "Admins can insert iso brokers"
  ON iso_brokers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')
    )
  );

CREATE POLICY "Admins can update iso brokers"
  ON iso_brokers FOR UPDATE
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

-- ============================================================
-- COMMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id),
  offer_id uuid REFERENCES offers(id),
  rep_id uuid REFERENCES user_profiles(id),
  iso_broker_id uuid REFERENCES iso_brokers(id),
  funded_amount numeric(15,2) NOT NULL CHECK (funded_amount > 0),
  commission_pct numeric(5,2) NOT NULL CHECK (commission_pct >= 0 AND commission_pct <= 100),
  commission_amount numeric(15,2) NOT NULL,
  payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending','approved','paid','held','disputed')),
  paid_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_org ON commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_commissions_deal ON commissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_commissions_rep ON commissions(rep_id);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read commissions in org"
  ON commissions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager')
    )
    OR rep_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert commissions"
  ON commissions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')
    )
  );

CREATE POLICY "Admins can update commissions"
  ON commissions FOR UPDATE
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

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id),
  application_id uuid REFERENCES applications(id),
  direction text CHECK (direction IN ('inbound','outbound','internal')),
  channel text CHECK (channel IN ('email','sms','portal','internal_note')),
  sender_user_id uuid REFERENCES user_profiles(id),
  recipient_user_id uuid REFERENCES user_profiles(id),
  recipient_email text,
  recipient_phone text,
  subject text,
  body text NOT NULL,
  delivery_status text DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','sent','delivered','failed','read')),
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_deal ON messages(deal_id);
CREATE INDEX IF NOT EXISTS idx_messages_app ON messages(application_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read messages in org"
  ON messages FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
    OR sender_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
    OR recipient_user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id),
  lead_id uuid REFERENCES leads(id),
  owner_id uuid REFERENCES owners(id),
  assigned_user_id uuid REFERENCES user_profiles(id),
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer DEFAULT 30,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  meeting_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned ON appointments(assigned_user_id);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read appointments in org"
  ON appointments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER set_contracts_updated_at BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_renewals_updated_at BEFORE UPDATE ON renewals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_iso_brokers_updated_at BEFORE UPDATE ON iso_brokers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_commissions_updated_at BEFORE UPDATE ON commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
