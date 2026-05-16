/*
  Operational CRM workflow models for production MCA processing.

  This migration keeps the existing tables intact and adds normalized support for
  configurable lead sources, deal-only document categories, explicit lender
  submission attachments, flexible commission recipients, merchant history, and
  default/risk events.
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS permissions text[] DEFAULT '{}';

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS ein_hash text;

CREATE INDEX IF NOT EXISTS idx_businesses_ein_hash
  ON public.businesses(organization_id, ein_hash)
  WHERE ein_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, slug)
);

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read lead sources"
  ON public.lead_sources FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage lead sources"
  ON public.lead_sources FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')));

INSERT INTO public.lead_sources (organization_id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Website', 'website'),
  ('00000000-0000-0000-0000-000000000001', 'Referral', 'referral'),
  ('00000000-0000-0000-0000-000000000001', 'Broker', 'broker'),
  ('00000000-0000-0000-0000-000000000001', 'ISO', 'iso'),
  ('00000000-0000-0000-0000-000000000001', 'Paid Ads', 'paid_ads'),
  ('00000000-0000-0000-0000-000000000001', 'Organic Search', 'organic_search'),
  ('00000000-0000-0000-0000-000000000001', 'Cold Email', 'cold_email'),
  ('00000000-0000-0000-0000-000000000001', 'Partner', 'partner'),
  ('00000000-0000-0000-0000-000000000001', 'Manual Entry', 'manual_entry')
ON CONFLICT (organization_id, slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  slug text NOT NULL,
  max_files integer,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id, slug)
);

ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read document categories"
  ON public.document_categories FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage document categories"
  ON public.document_categories FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','processor')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','processor')));

INSERT INTO public.document_categories (organization_id, name, slug, max_files, is_default) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Bank Statements', 'bank_statements', NULL, true),
  ('00000000-0000-0000-0000-000000000001', 'License Verification', 'license_verification', 2, true),
  ('00000000-0000-0000-0000-000000000001', 'Other', 'other', NULL, true)
ON CONFLICT (organization_id, slug) DO NOTHING;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_category_id uuid REFERENCES public.document_categories(id),
  ADD COLUMN IF NOT EXISTS bank_account_label text;

CREATE TABLE IF NOT EXISTS public.lender_submission_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  partner_submission_id uuid NOT NULL REFERENCES public.partner_submissions(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (partner_submission_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_lender_submission_attachments_submission
  ON public.lender_submission_attachments(partner_submission_id);

ALTER TABLE public.lender_submission_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read lender submission attachments"
  ON public.lender_submission_attachments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Sender roles can manage lender submission attachments"
  ON public.lender_submission_attachments FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','sales_rep')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','sales_rep')));

CREATE TABLE IF NOT EXISTS public.commission_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  recipient_user_profile_id uuid REFERENCES public.user_profiles(id),
  recipient_name text NOT NULL,
  recipient_type text NOT NULL DEFAULT 'other'
    CHECK (recipient_type IN ('referral_partner','junior_closer','senior_closer','broker','sales_rep','processor','other')),
  percentage numeric(5,2) DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  flat_amount numeric(15,2),
  notes text,
  payout_status text NOT NULL DEFAULT 'pending'
    CHECK (payout_status IN ('pending','approved','paid','held','clawed_back','cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.user_profiles(id),
  updated_by uuid REFERENCES public.user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_commission_recipients_deal
  ON public.commission_recipients(deal_id);

ALTER TABLE public.commission_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read commission recipients"
  ON public.commission_recipients FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')));

CREATE POLICY "Admins can manage commission recipients"
  ON public.commission_recipients FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')));

CREATE TABLE IF NOT EXISTS public.deal_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id),
  funding_partner_id uuid REFERENCES public.funding_partners(id),
  event_type text NOT NULL CHECK (event_type IN ('funded','defaulted','closed_not_funded','clawback','risk_note')),
  event_date timestamptz DEFAULT now(),
  amount numeric(15,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_deal_risk_events_business_partner
  ON public.deal_risk_events(business_id, funding_partner_id, event_type);

ALTER TABLE public.deal_risk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read deal risk events"
  ON public.deal_risk_events FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Managers can manage deal risk events"
  ON public.deal_risk_events FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','processor','underwriter')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','processor','underwriter')));

CREATE OR REPLACE VIEW public.merchant_submission_history
WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.organization_id,
  d.business_id,
  d.title,
  d.submission_sequence,
  d.stage_slug,
  d.requested_amount,
  d.funded_amount,
  d.funded_at,
  d.defaulted_at,
  d.default_reason,
  d.created_at,
  b.legal_name,
  b.dba,
  b.ein_last4,
  array_remove(array_agg(DISTINCT fp.name), NULL) AS lenders_submitted,
  array_remove(array_agg(DISTINCT a.body), NULL) AS activity_notes
FROM public.deals d
LEFT JOIN public.businesses b ON b.id = d.business_id
LEFT JOIN public.partner_submissions ps ON ps.deal_id = d.id
LEFT JOIN public.funding_partners fp ON fp.id = ps.funding_partner_id
LEFT JOIN public.activities a ON a.deal_id = d.id AND a.activity_type IN ('note','partner_submission','deal_funded','deal_declined','status_change')
GROUP BY d.id, b.id;
