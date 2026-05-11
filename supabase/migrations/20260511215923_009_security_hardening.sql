/*
  # Security Hardening - Phase 9

  ## Overview
  Addresses all security advisories from the Supabase security scanner.

  ## Changes

  ### 1. Fix Security Definer Views
  - Recreate `deal_summary_view`, `underwriting_queue_view`, and `renewal_opportunities_view`
    with `SECURITY INVOKER` (the default) so they run with the caller's privileges rather than
    the defining role's privileges. This ensures RLS on the underlying tables is respected.

  ### 2. Fix Function Search Path
  - Add `SET search_path = ''` to `set_updated_at`, `get_dashboard_metrics`,
    `repair_user_profile`, and `handle_new_user` to prevent search-path injection attacks.
  - All object references are fully-qualified with the `public.` schema prefix.

  ### 3. Fix Audit Log RLS Policy
  - Replace the "always true" INSERT policy on `audit_logs` with one that requires the
    inserting user to belong to the same organization as the log entry.

  ### 4. Revoke Public Execute on SECURITY DEFINER Functions
  - Revoke `EXECUTE` from the `anon` and `public` roles on `get_dashboard_metrics`,
    `repair_user_profile`, and `handle_new_user`.
  - Grant `EXECUTE` only to `authenticated` on `get_dashboard_metrics` and
    `repair_user_profile` (which are legitimate API calls).
  - `handle_new_user` is a trigger function — no role should call it directly.

  ### 5. Add RLS Policy for Organizations
  - The `organizations` table had RLS enabled but no policies, effectively blocking all access.
  - Add SELECT and UPDATE policies so authenticated users can read and update their own org.
*/

-- ============================================================
-- 1. RECREATE VIEWS WITHOUT SECURITY DEFINER
--    (DROP + CREATE since ALTER VIEW cannot change security)
-- ============================================================

DROP VIEW IF EXISTS public.deal_summary_view;
CREATE VIEW public.deal_summary_view
  WITH (security_invoker = true)
AS
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
    SELECT COUNT(*) FROM public.documents doc WHERE doc.deal_id = d.id
  ) AS document_count,
  (
    SELECT COUNT(*) FROM public.document_requests dr
    WHERE dr.deal_id = d.id AND dr.status IN ('requested','needs_replacement')
  ) AS missing_documents,
  (
    SELECT COUNT(*) FROM public.offers o
    WHERE o.deal_id = d.id AND o.status = 'received'
  ) AS active_offer_count
FROM public.deals d
LEFT JOIN public.businesses b ON b.id = d.business_id
LEFT JOIN public.user_profiles up ON up.id = d.assigned_user_id
WHERE d.deleted_at IS NULL;

DROP VIEW IF EXISTS public.underwriting_queue_view;
CREATE VIEW public.underwriting_queue_view
  WITH (security_invoker = true)
AS
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
FROM public.underwriting_reviews ur
JOIN public.deals d ON d.id = ur.deal_id
LEFT JOIN public.businesses b ON b.id = d.business_id
LEFT JOIN public.user_profiles uw ON uw.id = ur.assigned_underwriter_id
LEFT JOIN public.user_profiles rep ON rep.id = d.assigned_user_id
WHERE ur.status IN ('pending','in_review');

DROP VIEW IF EXISTS public.renewal_opportunities_view;
CREATE VIEW public.renewal_opportunities_view
  WITH (security_invoker = true)
AS
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
FROM public.renewals r
JOIN public.deals d ON d.id = r.original_deal_id
LEFT JOIN public.businesses b ON b.id = r.business_id
LEFT JOIN public.user_profiles up ON up.id = r.assigned_user_id
WHERE r.status IN ('eligible_soon','eligible','contacted');

-- ============================================================
-- 2. FIX FUNCTION SEARCH PATHS
-- ============================================================

-- set_updated_at: simple trigger, no SECURITY DEFINER needed
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- get_dashboard_metrics: keep SECURITY DEFINER so it can query cross-table;
-- lock down search_path and revoke public execute below
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'new_applications', (
      SELECT COUNT(*) FROM public.applications
      WHERE organization_id = p_org_id
        AND status = 'submitted'
        AND created_at >= NOW() - INTERVAL '30 days'
    ),
    'documents_pending', (
      SELECT COUNT(*) FROM public.document_requests
      WHERE organization_id = p_org_id
        AND status IN ('requested','needs_replacement')
    ),
    'underwriting_queue', (
      SELECT COUNT(*) FROM public.underwriting_reviews
      WHERE organization_id = p_org_id
        AND status IN ('pending','in_review')
    ),
    'offers_received', (
      SELECT COUNT(*) FROM public.offers
      WHERE organization_id = p_org_id
        AND status = 'received'
    ),
    'contracts_pending', (
      SELECT COUNT(*) FROM public.contracts
      WHERE organization_id = p_org_id
        AND status IN ('sent','viewed')
    ),
    'funded_volume_mtd', (
      SELECT COALESCE(SUM(funded_amount), 0) FROM public.deals
      WHERE organization_id = p_org_id
        AND stage_slug = 'funded'
        AND funded_at >= date_trunc('month', NOW())
    ),
    'renewal_opportunities', (
      SELECT COUNT(*) FROM public.renewals
      WHERE organization_id = p_org_id
        AND status IN ('eligible','eligible_soon')
    ),
    'active_deals', (
      SELECT COUNT(*) FROM public.deals
      WHERE organization_id = p_org_id
        AND stage_slug NOT IN ('funded','declined','lost_unresponsive')
        AND deleted_at IS NULL
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- repair_user_profile: SECURITY DEFINER required to insert profiles;
-- lock search_path and revoke anon execute below
CREATE OR REPLACE FUNCTION public.repair_user_profile(
  p_user_id uuid,
  p_email text,
  p_org_id uuid DEFAULT '00000000-0000-0000-0000-000000000001',
  p_role text DEFAULT 'client'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Only allow a user to repair their own profile
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: can only repair your own profile';
  END IF;

  SELECT id INTO v_profile_id
  FROM public.user_profiles
  WHERE user_id = p_user_id AND organization_id = p_org_id;

  IF v_profile_id IS NULL THEN
    INSERT INTO public.user_profiles (user_id, organization_id, email, role)
    VALUES (p_user_id, p_org_id, p_email, p_role)
    RETURNING id INTO v_profile_id;
  END IF;

  RETURN v_profile_id;
END;
$$;

-- handle_new_user: auth trigger, SECURITY DEFINER required;
-- lock search_path and revoke all direct execute below
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text := 'client';
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    v_role := NEW.raw_user_meta_data->>'role';
  END IF;

  INSERT INTO public.user_profiles (user_id, organization_id, email, first_name, last_name, role)
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

-- ============================================================
-- 3. REVOKE PUBLIC/ANON EXECUTE ON SECURITY DEFINER FUNCTIONS
-- ============================================================

-- Revoke from public (covers both anon and authenticated by default inheritance)
REVOKE ALL ON FUNCTION public.get_dashboard_metrics(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_user_profile(uuid, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Grant only authenticated users access to the two API-callable functions
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_user_profile(uuid, text, uuid, text) TO authenticated;
-- handle_new_user is a trigger function only — no direct role grants

-- ============================================================
-- 4. FIX AUDIT LOG INSERT POLICY (replace always-true WITH CHECK)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Users can insert audit logs for their own org"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT up.organization_id FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. ADD RLS POLICIES FOR ORGANIZATIONS
-- ============================================================

-- Members can read their own organization
CREATE POLICY "Members can view their organization"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT up.organization_id FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
    )
  );

-- Admins can update their organization settings
CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT up.organization_id FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('super_admin','admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT up.organization_id FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role IN ('super_admin','admin')
    )
  );
