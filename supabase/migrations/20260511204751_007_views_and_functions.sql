/*
  # Views, RPC Functions - Phase 7

  ## Overview
  Creates database views for reporting and RPC functions for complex operations.

  ## New Views
  1. `deal_summary_view` - Comprehensive deal overview
  2. `underwriting_queue_view` - Active underwriting queue
  3. `renewal_opportunities_view` - Eligible renewals

  ## RPC Functions
  1. `get_dashboard_metrics` - Returns KPI counts for dashboard
  2. `repair_user_profile` - Creates missing CRM profile for auth user
  3. `handle_new_user` - Auto-creates CRM profile on auth signup
*/

-- ============================================================
-- DEAL SUMMARY VIEW
-- ============================================================
CREATE OR REPLACE VIEW deal_summary_view AS
SELECT
  d.id,
  d.organization_id,
  d.stage_slug,
  d.requested_amount,
  d.approved_amount,
  d.funded_amount,
  d.funding_probability,
  d.created_at,
  d.updated_at,
  b.legal_name AS business_name,
  b.dba AS business_dba,
  b.monthly_gross_revenue,
  b.industry,
  CONCAT(up.first_name, ' ', up.last_name) AS assigned_rep_name,
  up.email AS assigned_rep_email,
  (
    SELECT COUNT(*) FROM documents doc WHERE doc.deal_id = d.id
  ) AS document_count,
  (
    SELECT COUNT(*) FROM document_requests dr WHERE dr.deal_id = d.id AND dr.status IN ('requested','needs_replacement')
  ) AS missing_documents,
  (
    SELECT COUNT(*) FROM offers o WHERE o.deal_id = d.id AND o.status = 'received'
  ) AS active_offer_count
FROM deals d
LEFT JOIN businesses b ON b.id = d.business_id
LEFT JOIN user_profiles up ON up.id = d.assigned_user_id
WHERE d.deleted_at IS NULL;

-- ============================================================
-- UNDERWRITING QUEUE VIEW
-- ============================================================
CREATE OR REPLACE VIEW underwriting_queue_view AS
SELECT
  ur.id AS review_id,
  ur.deal_id,
  ur.status AS review_status,
  ur.risk_tier,
  ur.underwriting_score,
  ur.created_at,
  d.stage_slug,
  d.requested_amount,
  b.legal_name AS business_name,
  b.monthly_gross_revenue,
  b.average_daily_balance,
  CONCAT(uw.first_name, ' ', uw.last_name) AS underwriter_name,
  CONCAT(rep.first_name, ' ', rep.last_name) AS assigned_rep_name
FROM underwriting_reviews ur
JOIN deals d ON d.id = ur.deal_id
LEFT JOIN businesses b ON b.id = d.business_id
LEFT JOIN user_profiles uw ON uw.id = ur.assigned_underwriter_id
LEFT JOIN user_profiles rep ON rep.id = d.assigned_user_id
WHERE ur.status IN ('pending','in_review');

-- ============================================================
-- RENEWAL OPPORTUNITIES VIEW
-- ============================================================
CREATE OR REPLACE VIEW renewal_opportunities_view AS
SELECT
  r.id,
  r.organization_id,
  r.status AS renewal_status,
  r.percent_paid_down,
  r.estimated_renewal_amount,
  r.renewal_date,
  d.id AS original_deal_id,
  d.funded_amount AS original_funded_amount,
  b.legal_name AS business_name,
  CONCAT(up.first_name, ' ', up.last_name) AS assigned_rep
FROM renewals r
JOIN deals d ON d.id = r.original_deal_id
LEFT JOIN businesses b ON b.id = r.business_id
LEFT JOIN user_profiles up ON up.id = r.assigned_user_id
WHERE r.status IN ('eligible_soon','eligible','contacted');

-- ============================================================
-- GET DASHBOARD METRICS RPC
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'new_applications', (
      SELECT COUNT(*) FROM applications
      WHERE organization_id = p_org_id
        AND status = 'submitted'
        AND created_at >= NOW() - INTERVAL '30 days'
    ),
    'documents_pending', (
      SELECT COUNT(*) FROM document_requests
      WHERE organization_id = p_org_id
        AND status IN ('requested','needs_replacement')
    ),
    'underwriting_queue', (
      SELECT COUNT(*) FROM underwriting_reviews
      WHERE organization_id = p_org_id
        AND status IN ('pending','in_review')
    ),
    'offers_received', (
      SELECT COUNT(*) FROM offers
      WHERE organization_id = p_org_id
        AND status = 'received'
    ),
    'contracts_pending', (
      SELECT COUNT(*) FROM contracts
      WHERE organization_id = p_org_id
        AND status IN ('sent','viewed')
    ),
    'funded_volume_mtd', (
      SELECT COALESCE(SUM(funded_amount), 0) FROM deals
      WHERE organization_id = p_org_id
        AND stage_slug = 'funded'
        AND funded_at >= date_trunc('month', NOW())
    ),
    'renewal_opportunities', (
      SELECT COUNT(*) FROM renewals
      WHERE organization_id = p_org_id
        AND status IN ('eligible','eligible_soon')
    ),
    'active_deals', (
      SELECT COUNT(*) FROM deals
      WHERE organization_id = p_org_id
        AND stage_slug NOT IN ('funded','declined','lost_unresponsive')
        AND deleted_at IS NULL
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ============================================================
-- REPAIR USER PROFILE RPC
-- ============================================================
CREATE OR REPLACE FUNCTION repair_user_profile(
  p_user_id uuid,
  p_email text,
  p_org_id uuid DEFAULT '00000000-0000-0000-0000-000000000001',
  p_role text DEFAULT 'client'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM user_profiles
  WHERE user_id = p_user_id AND organization_id = p_org_id;

  IF v_profile_id IS NULL THEN
    INSERT INTO user_profiles (user_id, organization_id, email, role)
    VALUES (p_user_id, p_org_id, p_email, p_role)
    RETURNING id INTO v_profile_id;
  END IF;

  RETURN v_profile_id;
END;
$$;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text := 'client';
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    v_role := NEW.raw_user_meta_data->>'role';
  END IF;

  INSERT INTO user_profiles (user_id, organization_id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    v_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    v_role
  )
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
