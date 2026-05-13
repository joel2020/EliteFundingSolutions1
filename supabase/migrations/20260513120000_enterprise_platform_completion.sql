/*
  # Enterprise platform completion

  Adds the explicit table and storage primitives requested for the production Elite
  Funding Solutions platform while preserving the existing CRM schema names used by
  the application.
*/

-- Profiles alias table for customer / CRM identity metadata.
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'read_only'
    CHECK (role IN ('super_admin','admin','underwriter','sales_rep','read_only')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read profiles in their organization"
  ON profiles FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage profiles"
  ON profiles FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- CRM user permissions table requested by the product spec.
CREATE TABLE IF NOT EXISTS crm_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  user_profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin','admin','underwriter','sales_rep','read_only')),
  is_active boolean DEFAULT true,
  invited_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_crm_users_org ON crm_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_users_role ON crm_users(role);
ALTER TABLE crm_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage crm users"
  ON crm_users FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin')));

CREATE TRIGGER set_crm_users_updated_at
  BEFORE UPDATE ON crm_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Funding requests table requested by the product spec. Applications remain the main intake record.
CREATE TABLE IF NOT EXISTS funding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id),
  requested_amount numeric(15,2) NOT NULL CHECK (requested_amount > 0),
  use_of_funds text NOT NULL,
  credit_score_range text,
  desired_timeline text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funding_requests_org ON funding_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_funding_requests_application ON funding_requests(application_id);
ALTER TABLE funding_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read funding requests"
  ON funding_requests FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can manage funding requests"
  ON funding_requests FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','underwriter','sales_rep')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','underwriter','sales_rep')));

CREATE TRIGGER set_funding_requests_updated_at
  BEFORE UPDATE ON funding_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Notes table for CRM activity and application collaboration.
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id),
  owner_id uuid REFERENCES owners(id),
  body text NOT NULL,
  is_internal boolean DEFAULT true,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_org ON notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_notes_application ON notes(application_id);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage notes"
  ON notes FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE TRIGGER set_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Lenders alias table for external funding partners.
CREATE TABLE IF NOT EXISTS lenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  funding_partner_id uuid REFERENCES funding_partners(id) ON DELETE SET NULL,
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  product_types text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_lenders_org ON lenders(organization_id);
ALTER TABLE lenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read lenders"
  ON lenders FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage lenders"
  ON lenders FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','underwriter')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','underwriter')));

CREATE TRIGGER set_lenders_updated_at
  BEFORE UPDATE ON lenders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES user_profiles(id),
  changed_at timestamptz DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_status_history_org ON status_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_status_history_application ON status_history(application_id);
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read status history"
  ON status_history FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can insert status history"
  ON status_history FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

-- Activity logs alias table for product analytics and audit visibility.
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_profile_id uuid REFERENCES user_profiles(id),
  application_id uuid REFERENCES applications(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_application ON activity_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read activity logs"
  ON activity_logs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','underwriter','sales_rep','viewer')));

CREATE POLICY "Members can insert activity logs"
  ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()));

-- Private storage buckets required for documents and avatars.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('application-documents', 'application-documents', false, 26214400, ARRAY['application/pdf','image/jpeg','image/png','image/heic']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Staff can read application documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'application-documents' AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff can upload application documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'application-documents' AND EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own avatars"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());
