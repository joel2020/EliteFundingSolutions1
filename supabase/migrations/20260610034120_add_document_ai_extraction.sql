alter table public.documents
  add column if not exists ai_extraction jsonb not null default '{}'::jsonb,
  add column if not exists ai_extracted_at timestamptz;

create index if not exists idx_documents_ai_extraction_gin
  on public.documents using gin (ai_extraction);
