/*
  # Nexus-style CRM workflow refinements

  Additive, non-destructive schema support for the Elite CRM redesign:
  approved-but-not-accepted tracking, configurable renewal thresholds, and
  granular role permissions. Existing production data and old migrations are not
  modified.
*/

ALTER TABLE deals ADD COLUMN IF NOT EXISTS not_accepted_reason text
  CHECK (not_accepted_reason IS NULL OR not_accepted_reason IN ('Rate too high','Term too short','Merchant went with competitor','Merchant not ready','No response','Other'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS reactivated_at timestamptz;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS merchant_interview_notes text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS interview_status text DEFAULT 'not_started';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS best_callback_time text;

ALTER TABLE current_positions ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE current_positions ADD COLUMN IF NOT EXISTS estimated_payoff_date date;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS renewal_paid_down_threshold numeric(5,2) DEFAULT 50 CHECK (renewal_paid_down_threshold >= 0 AND renewal_paid_down_threshold <= 100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS renewal_days_since_funding_threshold integer DEFAULT 90 CHECK (renewal_days_since_funding_threshold >= 0);

CREATE TABLE IF NOT EXISTS crm_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin','admin','manager','sales_rep','processor','underwriter','viewer','client')),
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, role, permission)
);

CREATE INDEX IF NOT EXISTS idx_crm_permissions_org_role ON crm_permissions(organization_id, role);
ALTER TABLE crm_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read crm permissions" ON crm_permissions;
CREATE POLICY "Staff can read crm permissions"
  ON crm_permissions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage crm permissions" ON crm_permissions;
CREATE POLICY "Admins can manage crm permissions"
  ON crm_permissions FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

INSERT INTO pipeline_stages (organization_id, name, slug, color, position, is_terminal) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Verification', 'verification', '#64748B', 20, false),
  ('00000000-0000-0000-0000-000000000001', 'Merchant Interview', 'merchant_interview', '#7C3AED', 21, false),
  ('00000000-0000-0000-0000-000000000001', 'Submission', 'submission', '#2563EB', 22, false),
  ('00000000-0000-0000-0000-000000000001', 'Approved', 'approved', '#2563EB', 23, false),
  ('00000000-0000-0000-0000-000000000001', 'Approved Not Accepted', 'approved_not_accepted', '#D97706', 24, true),
  ('00000000-0000-0000-0000-000000000001', 'Working Deal', 'working_deal', '#475569', 25, false),
  ('00000000-0000-0000-0000-000000000001', 'Contract Requested', 'contract_requested', '#D97706', 26, false),
  ('00000000-0000-0000-0000-000000000001', 'In Funding', 'in_funding', '#2563EB', 27, false),
  ('00000000-0000-0000-0000-000000000001', 'Withdrawn', 'withdrawn', '#64748B', 28, true)
ON CONFLICT (organization_id, slug) DO NOTHING;

DROP TRIGGER IF EXISTS set_crm_permissions_updated_at ON crm_permissions;
CREATE TRIGGER set_crm_permissions_updated_at BEFORE UPDATE ON crm_permissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
