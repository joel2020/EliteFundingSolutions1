/*
  Partner application conversion and faster customer intake.

  Adds deal-linked partner application upload records, application source/status
  fields, secure customer completion tokens, and document/application type
  metadata used by the CRM deal detail workflow.
*/

alter table public.applications
  add column if not exists application_source text not null default 'website',
  add column if not exists application_review_status text not null default 'submitted',
  add column if not exists completion_token text,
  add column if not exists completion_token_expires_at timestamptz,
  add column if not exists converted_from_partner_upload_id uuid,
  add column if not exists missing_fields text[] default '{}';

alter table public.deals
  add column if not exists application_link_token text,
  add column if not exists application_link_sent_at timestamptz;

alter table public.documents
  add column if not exists application_source text,
  add column if not exists application_variant text,
  add column if not exists related_partner_application_upload_id uuid;

create unique index if not exists idx_applications_completion_token
  on public.applications (completion_token)
  where completion_token is not null;

create unique index if not exists idx_deals_application_link_token
  on public.deals (application_link_token)
  where application_link_token is not null;

create index if not exists idx_documents_deal_application_variant
  on public.documents (organization_id, deal_id, application_variant, created_at desc)
  where deal_id is not null;

create table if not exists public.partner_application_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  deal_id uuid not null references public.deals(id) on delete cascade,
  application_id uuid references public.applications(id),
  original_document_id uuid references public.documents(id),
  converted_document_id uuid references public.documents(id),
  source_partner_name text,
  original_file_name text not null,
  original_file_mime_type text,
  original_file_size bigint,
  status text not null default 'uploaded'
    check (status in ('uploaded','extraction_needed','draft_ready','converted','saved_to_deal','failed')),
  extracted_payload jsonb not null default '{}'::jsonb,
  edited_payload jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  deleted_at timestamptz
);

alter table public.partner_application_uploads enable row level security;

create index if not exists idx_partner_application_uploads_deal
  on public.partner_application_uploads (organization_id, deal_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_partner_application_uploads_application
  on public.partner_application_uploads (application_id)
  where application_id is not null;

drop trigger if exists set_partner_application_uploads_updated_at on public.partner_application_uploads;
create trigger set_partner_application_uploads_updated_at
  before update on public.partner_application_uploads
  for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'applications_converted_from_partner_upload_id_fkey'
  ) then
    alter table public.applications
      add constraint applications_converted_from_partner_upload_id_fkey
      foreign key (converted_from_partner_upload_id)
      references public.partner_application_uploads(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'documents_related_partner_application_upload_id_fkey'
  ) then
    alter table public.documents
      add constraint documents_related_partner_application_upload_id_fkey
      foreign key (related_partner_application_upload_id)
      references public.partner_application_uploads(id);
  end if;
end $$;

create policy "Staff can read partner application uploads"
  on public.partner_application_uploads
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer'])
  );

create policy "Staff can insert partner application uploads"
  on public.partner_application_uploads
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter'])
  );

create policy "Staff can update partner application uploads"
  on public.partner_application_uploads
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter'])
  )
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter'])
  );

grant select, insert, update on public.partner_application_uploads to authenticated;

comment on table public.partner_application_uploads is 'Deal-linked partner application uploads and Elite-branded conversion metadata.';
comment on column public.applications.application_source is 'website, rep_referral, iso_referral, partner_upload, crm_manual, or customer_completion_link.';
comment on column public.applications.application_review_status is 'CRM-facing application workflow state independent of legacy application status check.';
