/*
  Platform readiness hardening

  Additive guardrails for launch readiness:
  - stable public IDs for externally referenced applications/deals
  - workflow transition rules for deal stages
  - notification/event inbox table for CRM follow-up surfaces
  - reporting source-of-truth view for funnel, volume, offer, and commission metrics
  - indexes and check constraints for high-traffic operational paths
*/

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS public_id text;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS public_id text;

WITH numbered AS (
  SELECT
    id,
    'APP-' || lpad(row_number() OVER (PARTITION BY organization_id ORDER BY submitted_at NULLS LAST, created_at, id)::text, 10, '0') AS generated_public_id
  FROM public.applications
  WHERE public_id IS NULL
)
UPDATE public.applications applications
SET public_id = numbered.generated_public_id
FROM numbered
WHERE applications.id = numbered.id;

WITH numbered AS (
  SELECT
    id,
    'DEAL-' || lpad(row_number() OVER (PARTITION BY organization_id ORDER BY created_at, id)::text, 10, '0') AS generated_public_id
  FROM public.deals
  WHERE public_id IS NULL
)
UPDATE public.deals deals
SET public_id = numbered.generated_public_id
FROM numbered
WHERE deals.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_public_id
  ON public.applications (organization_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_public_id
  ON public.deals (organization_id, public_id)
  WHERE public_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_reporting_org_created
  ON public.deals (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deals_reporting_org_stage
  ON public.deals (organization_id, stage_slug, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deals_reporting_funded
  ON public.deals (organization_id, funded_at DESC)
  WHERE deleted_at IS NULL AND funded_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_submissions_reporting
  ON public.partner_submissions (organization_id, deal_id, funding_partner_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_offers_reporting
  ON public.offers (organization_id, deal_id, funding_partner_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_documents_deal_category
  ON public.documents (organization_id, deal_id, document_type, created_at DESC)
  WHERE deal_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_public_id_format_check'
      AND conrelid = 'public.applications'::regclass
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_public_id_format_check
      CHECK (public_id IS NULL OR public_id ~ '^APP-[A-F0-9]{10}$') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_public_id_format_check'
      AND conrelid = 'public.deals'::regclass
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_public_id_format_check
      CHECK (public_id IS NULL OR public_id ~ '^DEAL-[A-F0-9]{10}$') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_funded_state_check'
      AND conrelid = 'public.deals'::regclass
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_funded_state_check
      CHECK (
        stage_slug <> 'funded'
        OR (funded_at IS NOT NULL AND COALESCE(funded_amount, 0) > 0)
      ) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.crm_workflow_stage_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  required_permission text,
  requires_accepted_offer boolean NOT NULL DEFAULT false,
  requires_complete_documents boolean NOT NULL DEFAULT false,
  requires_funded_amount boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, from_stage, to_stage)
);

ALTER TABLE public.crm_workflow_stage_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read workflow stage rules"
  ON public.crm_workflow_stage_rules FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  );

CREATE POLICY "Admins can manage workflow stage rules"
  ON public.crm_workflow_stage_rules FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager')
    )
  );

INSERT INTO public.crm_workflow_stage_rules
  (organization_id, from_stage, to_stage, required_permission, requires_accepted_offer, requires_complete_documents, requires_funded_amount)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'lead_captured', 'application_submitted', null, false, false, false),
  ('00000000-0000-0000-0000-000000000001', 'application_submitted', 'underwriting_review', null, false, true, false),
  ('00000000-0000-0000-0000-000000000001', 'underwriting_review', 'offers_received', 'send_to_lenders', false, true, false),
  ('00000000-0000-0000-0000-000000000001', 'offers_received', 'offer_presented', null, false, false, false),
  ('00000000-0000-0000-0000-000000000001', 'offer_presented', 'contract_sent', null, true, false, false),
  ('00000000-0000-0000-0000-000000000001', 'contract_sent', 'contract_signed', null, true, false, false),
  ('00000000-0000-0000-0000-000000000001', 'contract_signed', 'funded', 'mark_funded', true, true, true)
ON CONFLICT (organization_id, from_stage, to_stage) DO UPDATE
SET required_permission = EXCLUDED.required_permission,
    requires_accepted_offer = EXCLUDED.requires_accepted_offer,
    requires_complete_documents = EXCLUDED.requires_complete_documents,
    requires_funded_amount = EXCLUDED.requires_funded_amount,
    is_active = true;

CREATE TABLE IF NOT EXISTS public.crm_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  recipient_user_profile_id uuid REFERENCES public.user_profiles(id),
  actor_user_profile_id uuid REFERENCES public.user_profiles(id),
  resource_type text NOT NULL,
  resource_id uuid,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','critical')),
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_crm_notifications_recipient
  ON public.crm_notifications (organization_id, recipient_user_profile_id, status, created_at DESC);

ALTER TABLE public.crm_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their CRM notifications"
  ON public.crm_notifications FOR SELECT
  TO authenticated
  USING (
    recipient_user_profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager')
    )
  );

CREATE POLICY "Staff can create CRM notifications"
  ON public.crm_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  );

CREATE POLICY "Users can update their CRM notifications"
  ON public.crm_notifications FOR UPDATE
  TO authenticated
  USING (
    recipient_user_profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    recipient_user_profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

DROP VIEW IF EXISTS public.crm_reporting_metrics;
CREATE VIEW public.crm_reporting_metrics
WITH (security_invoker = true) AS
SELECT
  d.organization_id,
  d.id AS deal_id,
  d.public_id AS deal_public_id,
  d.business_id,
  d.application_id,
  d.assigned_user_id,
  d.junior_closer_id,
  d.senior_closer_id,
  d.iso_broker_id,
  d.lead_source,
  d.stage_slug,
  d.requested_amount,
  d.approved_amount,
  d.funded_amount,
  d.created_at,
  d.funded_at,
  b.legal_name AS business_name,
  COUNT(DISTINCT ps.id) AS lender_submission_count,
  COUNT(DISTINCT o.id) AS offer_count,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'accepted') AS accepted_offer_count,
  COALESCE(SUM(DISTINCT cr.flat_amount), 0) AS flat_commission_total,
  COALESCE(SUM(c.commission_amount), 0) AS legacy_commission_total,
  EXISTS (
    SELECT 1
    FROM public.deal_risk_events dre
    WHERE dre.deal_id = d.id
      AND dre.event_type = 'defaulted'
  ) AS has_default_event
FROM public.deals d
LEFT JOIN public.businesses b ON b.id = d.business_id
LEFT JOIN public.partner_submissions ps ON ps.deal_id = d.id
LEFT JOIN public.offers o ON o.deal_id = d.id
LEFT JOIN public.commission_recipients cr ON cr.deal_id = d.id
LEFT JOIN public.commissions c ON c.deal_id = d.id
WHERE d.deleted_at IS NULL
GROUP BY
  d.organization_id,
  d.id,
  d.public_id,
  d.business_id,
  d.application_id,
  d.assigned_user_id,
  d.junior_closer_id,
  d.senior_closer_id,
  d.iso_broker_id,
  d.lead_source,
  d.stage_slug,
  d.requested_amount,
  d.approved_amount,
  d.funded_amount,
  d.created_at,
  d.funded_at,
  b.legal_name;
