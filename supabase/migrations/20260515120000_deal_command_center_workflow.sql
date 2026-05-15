/*
  # Deal Command Center Workflow

  Adds safe, non-destructive workflow fields and constraint expansions for deal-level
  readiness checklists, document review, lender submissions, offer/task activity,
  and secure operational controls.
*/

-- Expand document request workflow statuses/types/categories without duplicating tables.
ALTER TABLE public.document_requests
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'submission',
  ADD COLUMN IF NOT EXISTS related_document_id uuid REFERENCES public.documents(id),
  ADD COLUMN IF NOT EXISTS waived_by uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS waived_at timestamptz;

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.document_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%document_type%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.document_requests DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.document_requests
  ADD CONSTRAINT document_requests_document_type_check
  CHECK (document_type IN (
    'bank_statement','bank_statements','drivers_license','driver_license','owner_id_verification',
    'voided_check','business_tax_returns','processing_statements','proof_of_ownership',
    'signed_application','completed_application','contract','signed_contract','proof_of_address',
    'business_verification','advance_statements','payoff_letter','final_bank_verification',
    'final_owner_id_verification','funding_amount_confirmed','payment_frequency_confirmed',
    'approved_offer','accepted_offer','stips_satisfied','stipulation','other',
    'owner_name','cell_phone','business_legal_name','requested_amount','ein','ssn'
  ));

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.document_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.document_requests DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.document_requests
  ADD CONSTRAINT document_requests_status_check
  CHECK (status IN ('missing','requested','uploaded','received','in_review','approved','rejected','needs_replacement','waived'));

ALTER TABLE public.document_requests
  ADD CONSTRAINT document_requests_category_check
  CHECK (category IN ('submission','funding','stipulation','compliance'));

CREATE INDEX IF NOT EXISTS idx_doc_requests_category ON public.document_requests(category);
CREATE INDEX IF NOT EXISTS idx_doc_requests_related_document ON public.document_requests(related_document_id);

-- Expand document status for expired files and keep signed-URL-only storage posture.
DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.documents'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_status_check
  CHECK (status IN ('uploaded','in_review','approved','rejected','needs_replacement','expired'));

-- Lender workflow can progress all the way to funded.
DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.partner_submissions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.partner_submissions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.partner_submissions
  ADD COLUMN IF NOT EXISTS conditions text,
  ADD CONSTRAINT partner_submissions_status_check
  CHECK (status IN ('draft','submitted','in_review','more_info_needed','approved','declined','withdrawn','funded'));

-- Deal-scoped tasks can reference checklist items.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS related_checklist_item_id uuid REFERENCES public.document_requests(id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_checklist_item ON public.tasks(related_checklist_item_id);

-- Activity timeline must accept normalized deal command-center event names.
DO $$
DECLARE constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.activities'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%activity_type%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.activities DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS resource_type text,
  ADD COLUMN IF NOT EXISTS resource_id uuid,
  ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type IN (
    'note','call','email','sms','status_change','document_event','document','task','assignment','system',
    'partner_submission','offer','deal_funded','deal_declined','sensitive_reveal'
  ));

CREATE INDEX IF NOT EXISTS idx_activities_resource ON public.activities(resource_type, resource_id);

-- Ensure the private document bucket remains private; signed URLs are issued by the app API.
UPDATE storage.buckets
SET public = false
WHERE id = 'application-documents';
