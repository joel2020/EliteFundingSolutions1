/*
  CRM operating system expansion:
  - Persistent AI bank statement analysis
  - Position-aware lender criteria
  - Knowledge base articles
  - Public record / court check event types
*/

ALTER TABLE public.deal_financials
  ADD COLUMN IF NOT EXISTS total_deposits numeric(15,2),
  ADD COLUMN IF NOT EXISTS total_withdrawals numeric(15,2),
  ADD COLUMN IF NOT EXISTS net_cash_flow numeric(15,2),
  ADD COLUMN IF NOT EXISTS average_daily_ledger_balance numeric(15,2),
  ADD COLUMN IF NOT EXISTS negative_balance_days_per_month integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nsf_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS analysis_confidence numeric(5,2),
  ADD COLUMN IF NOT EXISTS analysis_summary text,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS analyzed_by uuid REFERENCES public.user_profiles(id);

ALTER TABLE public.current_positions
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS recurrence_pattern text,
  ADD COLUMN IF NOT EXISTS occurrences integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence numeric(5,2),
  ADD COLUMN IF NOT EXISTS first_seen date,
  ADD COLUMN IF NOT EXISTS last_seen date;

ALTER TABLE public.funding_partners
  ADD COLUMN IF NOT EXISTS max_active_positions integer,
  ADD COLUMN IF NOT EXISTS min_average_daily_balance numeric(15,2),
  ADD COLUMN IF NOT EXISTS max_negative_balance_days integer,
  ADD COLUMN IF NOT EXISTS max_nsf_count integer,
  ADD COLUMN IF NOT EXISTS required_documents text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accepts_stacked_positions boolean DEFAULT true;

CREATE TABLE IF NOT EXISTS public.bank_statement_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('queued','processing','completed','failed')),
  total_deposits numeric(15,2) DEFAULT 0,
  total_withdrawals numeric(15,2) DEFAULT 0,
  net_cash_flow numeric(15,2) DEFAULT 0,
  average_daily_ledger_balance numeric(15,2),
  negative_balance_days_per_month integer DEFAULT 0,
  nsf_count integer DEFAULT 0,
  position_count integer DEFAULT 0,
  detected_positions jsonb DEFAULT '[]'::jsonb,
  source_document_ids uuid[] DEFAULT '{}',
  extraction_notes text,
  confidence numeric(5,2),
  raw_metrics jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_statement_analyses_deal
  ON public.bank_statement_analyses(organization_id, deal_id, created_at DESC);

ALTER TABLE public.bank_statement_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read bank statement analyses" ON public.bank_statement_analyses;
CREATE POLICY "Staff can read bank statement analyses"
  ON public.bank_statement_analyses FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff can create bank statement analyses" ON public.bank_statement_analyses;
CREATE POLICY "Staff can create bank statement analyses"
  ON public.bank_statement_analyses FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')));

CREATE TABLE IF NOT EXISTS public.knowledge_base_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  category text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  image_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(category,'') || ' ' || coalesce(title,'') || ' ' || coalesce(body,''))
  ) STORED,
  created_by uuid REFERENCES public.user_profiles(id),
  updated_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_org_category
  ON public.knowledge_base_articles(organization_id, category, status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_articles_search
  ON public.knowledge_base_articles USING gin(search_vector);

ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can read knowledge base articles" ON public.knowledge_base_articles;
CREATE POLICY "Team can read knowledge base articles"
  ON public.knowledge_base_articles FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid()) AND status <> 'archived');

DROP POLICY IF EXISTS "Admins can manage knowledge base articles" ON public.knowledge_base_articles;
CREATE POLICY "Admins can manage knowledge base articles"
  ON public.knowledge_base_articles FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.user_profiles WHERE user_id = auth.uid() AND role IN ('super_admin','admin','manager')));

DROP TRIGGER IF EXISTS set_knowledge_base_articles_updated_at ON public.knowledge_base_articles;
CREATE TRIGGER set_knowledge_base_articles_updated_at
  BEFORE UPDATE ON public.knowledge_base_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.deal_risk_events
  DROP CONSTRAINT IF EXISTS deal_risk_events_event_type_check;

ALTER TABLE public.deal_risk_events
  ADD CONSTRAINT deal_risk_events_event_type_check
  CHECK (event_type IN ('funded','defaulted','closed_not_funded','clawback','risk_note','judgment','lien','tax_lien','ucc','bankruptcy','court_record','public_record'));

INSERT INTO public.knowledge_base_articles (organization_id, category, title, body, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Getting Started', 'CRM operating flow', 'Use Prospects for leads that have not become submitted deals yet. Use Pipeline for active deal workflow from submitted package through lender review, offers, contracts, funded outcomes, or The Vault.', 'published'),
  ('00000000-0000-0000-0000-000000000001', 'Pipeline & Deal Flow', 'New deal checklist', 'Create or link the client, upload the signed application, upload bank statements and supporting documents, run AI analysis, review positions, then submit only to eligible lenders.', 'published'),
  ('00000000-0000-0000-0000-000000000001', 'AI Analysis Tools', 'Bank statement review', 'The AI analysis panel reads bank statements and saves total deposits, withdrawals, net cash flow, average ledger balance, negative days, NSF count, and recurring debit positions.', 'published'),
  ('00000000-0000-0000-0000-000000000001', 'Lender Submission Process', 'Submission package rules', 'Every lender submission must include the generated Elite Funding application PDF with business information, owner information, funding request, signature field, and date field.', 'published'),
  ('00000000-0000-0000-0000-000000000001', 'The Vault', 'Revisiting unfunded deals', 'The Vault stores declined, withdrawn, incomplete, and closed-not-funded files. Add notes with follow-up timing and review lender reasons before reworking the deal.', 'published')
ON CONFLICT DO NOTHING;
