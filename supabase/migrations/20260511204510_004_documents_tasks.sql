/*
  # Documents, Document Requests, Tasks, and Notes - Phase 4

  ## Overview
  Creates document management and task/note tracking.

  ## New Tables
  1. `document_requests` - What documents are required per deal
  2. `documents` - Uploaded files linked to deals/applications
  3. `tasks` - Assigned tasks per record
  4. `notes` - Internal notes per record

  ## Security
  - RLS on all tables
  - Clients can upload/view their own documents
  - Staff can manage all docs in org
*/

-- ============================================================
-- DOCUMENT REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id),
  application_id uuid REFERENCES applications(id),
  document_type text NOT NULL
    CHECK (document_type IN (
      'bank_statements','drivers_license','voided_check','business_tax_returns',
      'processing_statements','proof_of_ownership','signed_application',
      'signed_contract','other'
    )),
  label text NOT NULL,
  description text,
  required boolean DEFAULT true,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','uploaded','in_review','approved','rejected','needs_replacement','waived')),
  due_date date,
  assigned_user_id uuid REFERENCES user_profiles(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_doc_requests_org ON document_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_doc_requests_deal ON document_requests(deal_id);
CREATE INDEX IF NOT EXISTS idx_doc_requests_app ON document_requests(application_id);

ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read doc requests in org"
  ON document_requests FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
    OR application_id IN (
      SELECT a.id FROM applications a
      JOIN businesses b ON b.id = a.business_id
      JOIN business_owners bo ON bo.business_id = b.id
      JOIN owners o ON o.id = bo.owner_id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert doc requests"
  ON document_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor')
    )
  );

CREATE POLICY "Staff can update doc requests"
  ON document_requests FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter')
    )
  );

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id),
  application_id uuid REFERENCES applications(id),
  document_request_id uuid REFERENCES document_requests(id),
  uploaded_by_user_id uuid REFERENCES auth.users(id),
  document_type text NOT NULL,
  label text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','in_review','approved','rejected','needs_replacement')),
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_deal ON documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_documents_app ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read documents in org"
  ON documents FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
    OR uploaded_by_user_id = auth.uid()
  );

CREATE POLICY "Users can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
    OR uploaded_by_user_id = auth.uid()
  );

CREATE POLICY "Staff can update documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','processor','underwriter')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('super_admin','admin','manager','processor','underwriter')
    )
  );

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  deal_id uuid REFERENCES deals(id),
  application_id uuid REFERENCES applications(id),
  business_id uuid REFERENCES businesses(id),
  lead_id uuid REFERENCES leads(id),
  title text NOT NULL,
  description text,
  due_date timestamptz,
  assigned_user_id uuid REFERENCES user_profiles(id),
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deal ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read tasks in org"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER set_doc_requests_updated_at BEFORE UPDATE ON document_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
