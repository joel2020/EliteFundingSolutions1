/*
  Final production-readiness hardening.

  - Moves RLS helper execution to private, non-exposed functions.
  - Removes broad authenticated RPC execute access from public SECURITY DEFINER functions.
  - Keeps rate_limits server-only and documents that model.
  - Adds explicit storage object policies for application-documents.
  - Adds high-impact FK indexes reported by the Supabase performance advisor.
*/

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create or replace function private.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select up.organization_id
  from public.user_profiles up
  where up.user_id = (select auth.uid())
    and up.is_active = true
  limit 1
$$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select up.role
  from public.user_profiles up
  where up.user_id = (select auth.uid())
    and up.is_active = true
  limit 1
$$;

create or replace function private.storage_application_id(object_name text)
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  path_parts text[];
begin
  path_parts := storage.foldername(object_name);
  if array_length(path_parts, 1) < 2 then
    return null;
  end if;

  begin
    return path_parts[2]::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$$;

revoke all on function private.current_user_org_id() from public;
revoke all on function private.current_user_role() from public;
revoke all on function private.storage_application_id(text) from public;
grant execute on function private.current_user_org_id() to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.storage_application_id(text) to authenticated;
grant execute on function private.current_user_org_id() to service_role;
grant execute on function private.current_user_role() to service_role;
grant execute on function private.storage_application_id(text) to service_role;

comment on schema private is 'Private, non-API schema for privileged helper functions used by RLS policies.';
comment on function private.current_user_org_id() is 'Returns the active authenticated user organization for RLS checks. Not exposed through the public API schema.';
comment on function private.current_user_role() is 'Returns the active authenticated user CRM role for RLS checks. Not exposed through the public API schema.';
comment on function private.storage_application_id(text) is 'Safely extracts an application UUID from application-documents object paths shaped org_id/application_id/file_name.';

create or replace function public.update_gmail_tokens_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.update_gmail_tokens_updated_at() is 'Maintains gmail_tokens.updated_at with an immutable empty search_path.';

revoke execute on function public.current_user_org_id() from authenticated;
revoke execute on function public.current_user_role() from authenticated;
revoke execute on function public.get_dashboard_metrics(uuid) from authenticated;
revoke execute on function public.repair_user_profile(uuid, text, uuid, text) from authenticated;

comment on function public.current_user_org_id() is 'Deprecated public helper. RLS policies use private.current_user_org_id() so this function is not RPC-callable by authenticated users.';
comment on function public.current_user_role() is 'Deprecated public helper. RLS policies use private.current_user_role() so this function is not RPC-callable by authenticated users.';
comment on function public.get_dashboard_metrics(uuid) is 'Server-only dashboard metrics helper. Execute is revoked from authenticated browser clients; use service-role API routes.';
comment on function public.repair_user_profile(uuid, text, uuid, text) is 'Restricted profile repair helper. Execute is revoked from authenticated browser clients to prevent role/org self-repair abuse.';

revoke all on table public.rate_limits from anon;
revoke all on table public.rate_limits from authenticated;

drop policy if exists "Service role manages rate limits" on public.rate_limits;
create policy "Service role manages rate limits"
  on public.rate_limits
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.rate_limits is 'Server-only persistent rate-limit state. Browser roles have no grants and no anon/authenticated RLS policies; application code accesses it only with the Supabase service role.';
comment on policy "Service role manages rate limits" on public.rate_limits is 'Exists to document intentional server-only access and satisfy RLS policy linting. The service role already bypasses RLS.';

drop policy if exists "restricted crm read application_sensitive_data" on public.application_sensitive_data;
create policy "restricted crm read application_sensitive_data"
  on public.application_sensitive_data
  for select
  to authenticated
  using (private.current_user_role() = any (array['admin','super_admin','underwriter']));

drop policy if exists "restricted crm write application_sensitive_data" on public.application_sensitive_data;
create policy "restricted crm write application_sensitive_data"
  on public.application_sensitive_data
  for all
  to authenticated
  using (private.current_user_role() = any (array['admin','super_admin']))
  with check (private.current_user_role() = any (array['admin','super_admin']));

drop policy if exists "crm read application_underwriting" on public.application_underwriting;
create policy "crm read application_underwriting"
  on public.application_underwriting
  for select
  to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor','sales_rep','viewer']));

drop policy if exists "crm write application_underwriting" on public.application_underwriting;
create policy "crm write application_underwriting"
  on public.application_underwriting
  for all
  to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor']))
  with check (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor']));

drop policy if exists "Insert audit logs in org" on public.audit_logs;
create policy "Insert audit logs in org"
  on public.audit_logs
  for insert
  to authenticated
  with check (organization_id = private.current_user_org_id());

drop policy if exists "Read audit logs in org" on public.audit_logs;
create policy "Read audit logs in org"
  on public.audit_logs
  for select
  to authenticated
  using (organization_id = private.current_user_org_id());

drop policy if exists "crm read communications" on public.communications;
create policy "crm read communications"
  on public.communications
  for select
  to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor','sales_rep','viewer']));

drop policy if exists "crm write communications" on public.communications;
create policy "crm write communications"
  on public.communications
  for all
  to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor','sales_rep']))
  with check (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor','sales_rep']));

drop policy if exists "crm read companies" on public.companies;
create policy "crm read companies"
  on public.companies
  for select
  to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor','sales_rep','viewer']));

drop policy if exists "crm write companies" on public.companies;
create policy "crm write companies"
  on public.companies
  for all
  to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor','sales_rep']))
  with check (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor','sales_rep']));

drop policy if exists "crm read consent_records" on public.consent_records;
create policy "crm read consent_records"
  on public.consent_records
  for select
  to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor','sales_rep','viewer']));

drop policy if exists "crm write consent_records" on public.consent_records;
create policy "crm write consent_records"
  on public.consent_records
  for all
  to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor']))
  with check (private.current_user_role() = any (array['super_admin','admin','manager','underwriter','processor']));

drop policy if exists "Admins update own organization" on public.organizations;
create policy "Admins update own organization"
  on public.organizations
  for update
  to authenticated
  using (id = private.current_user_org_id() and private.current_user_role() = any (array['super_admin','admin']))
  with check (id = private.current_user_org_id());

drop policy if exists "View own organization" on public.organizations;
create policy "View own organization"
  on public.organizations
  for select
  to authenticated
  using (id = private.current_user_org_id());

drop policy if exists "Admins insert profiles in org" on public.user_profiles;
create policy "Admins insert profiles in org"
  on public.user_profiles
  for insert
  to authenticated
  with check (organization_id = private.current_user_org_id() and private.current_user_role() = any (array['super_admin','admin','manager']));

drop policy if exists "Admins update profiles in org" on public.user_profiles;
create policy "Admins update profiles in org"
  on public.user_profiles
  for update
  to authenticated
  using (organization_id = private.current_user_org_id() and private.current_user_role() = any (array['super_admin','admin','manager']))
  with check (organization_id = private.current_user_org_id());

drop policy if exists "Read profiles in same org" on public.user_profiles;
create policy "Read profiles in same org"
  on public.user_profiles
  for select
  to authenticated
  using (organization_id = private.current_user_org_id());

drop policy if exists "CRM staff can read org application documents" on storage.objects;
drop policy if exists "CRM staff can upload org application documents" on storage.objects;
drop policy if exists "CRM staff can delete org application documents" on storage.objects;
drop policy if exists "Portal clients can read own application documents" on storage.objects;
drop policy if exists "Portal clients can upload own application documents" on storage.objects;

create policy "CRM staff can read org application documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1
      from public.documents d
      join public.user_profiles up
        on up.organization_id = d.organization_id
       and up.user_id = (select auth.uid())
       and up.is_active = true
       and up.role = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer'])
      where d.storage_path = storage.objects.name
    )
  );

create policy "Portal clients can read own application documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1
      from public.documents d
      join public.applications a on a.id = d.application_id and a.organization_id = d.organization_id
      join public.business_owners bo on bo.business_id = a.business_id and bo.organization_id = a.organization_id
      join public.owners o on o.id = bo.owner_id and o.organization_id = a.organization_id
      join public.user_profiles up
        on up.user_id = (select auth.uid())
       and up.organization_id = d.organization_id
       and up.role = 'client'
       and up.is_active = true
      where d.storage_path = storage.objects.name
        and o.user_id = (select auth.uid())
    )
  );

create policy "CRM staff can upload org application documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = private.current_user_org_id()::text
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter'])
  );

create policy "Portal clients can upload own application documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = private.current_user_org_id()::text
    and private.current_user_role() = 'client'
    and exists (
      select 1
      from public.applications a
      join public.business_owners bo on bo.business_id = a.business_id and bo.organization_id = a.organization_id
      join public.owners o on o.id = bo.owner_id and o.organization_id = a.organization_id
      where a.id = private.storage_application_id(storage.objects.name)
        and a.organization_id = private.current_user_org_id()
        and o.user_id = (select auth.uid())
    )
  );

create policy "CRM staff can delete org application documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = private.current_user_org_id()::text
    and private.current_user_role() = any (array['super_admin','admin','manager','processor'])
  );

comment on policy "CRM staff can read org application documents" on storage.objects is 'No public or anonymous reads. CRM read access is limited to active internal users whose organization owns the documents row matching the object path.';
comment on policy "Portal clients can read own application documents" on storage.objects is 'Portal read access is limited to client users linked to the application owner record.';
comment on policy "CRM staff can upload org application documents" on storage.objects is 'Direct authenticated CRM uploads must stay under the user organization folder. Server routes remain the preferred upload path.';
comment on policy "Portal clients can upload own application documents" on storage.objects is 'Portal direct uploads must target an application owned by the authenticated client. Server routes remain the preferred upload path.';
comment on policy "CRM staff can delete org application documents" on storage.objects is 'Only internal operations roles can delete private application document objects.';

create index if not exists idx_activities_lead_id_fk on public.activities (lead_id);
create index if not exists idx_activities_owner_id_fk on public.activities (owner_id);
create index if not exists idx_activities_performed_by_fk on public.activities (performed_by);
create index if not exists idx_application_sensitive_data_lead_id_fk on public.application_sensitive_data (lead_id);
create index if not exists idx_application_sensitive_data_organization_id_fk on public.application_sensitive_data (organization_id);
create index if not exists idx_applications_assigned_user_id_fk on public.applications (assigned_user_id);
create index if not exists idx_applications_created_by_fk on public.applications (created_by);
create index if not exists idx_applications_lead_id_fk on public.applications (lead_id);
create index if not exists idx_applications_updated_by_fk on public.applications (updated_by);
create index if not exists idx_commission_recipients_created_by_fk on public.commission_recipients (created_by);
create index if not exists idx_commission_recipients_organization_id_fk on public.commission_recipients (organization_id);
create index if not exists idx_commission_recipients_recipient_user_profile_id_fk on public.commission_recipients (recipient_user_profile_id);
create index if not exists idx_commission_recipients_updated_by_fk on public.commission_recipients (updated_by);
create index if not exists idx_commissions_iso_broker_id_fk on public.commissions (iso_broker_id);
create index if not exists idx_commissions_offer_id_fk on public.commissions (offer_id);
create index if not exists idx_crm_notifications_actor_user_profile_id_fk on public.crm_notifications (actor_user_profile_id);
create index if not exists idx_crm_notifications_recipient_user_profile_id_fk on public.crm_notifications (recipient_user_profile_id);
create index if not exists idx_deals_best_funding_partner_id_fk on public.deals (best_funding_partner_id);
create index if not exists idx_deals_created_by_fk on public.deals (created_by);
create index if not exists idx_deals_duplicate_of_business_id_fk on public.deals (duplicate_of_business_id);
create index if not exists idx_deals_lead_id_fk on public.deals (lead_id);
create index if not exists idx_deals_senior_closer_id_fk on public.deals (senior_closer_id);
create index if not exists idx_deals_stage_id_fk on public.deals (stage_id);
create index if not exists idx_deals_updated_by_fk on public.deals (updated_by);
create index if not exists idx_documents_document_category_id_fk on public.documents (document_category_id);
create index if not exists idx_documents_document_request_id_fk on public.documents (document_request_id);
create index if not exists idx_documents_lead_id_fk on public.documents (lead_id);
create index if not exists idx_documents_reviewed_by_fk on public.documents (reviewed_by);
create index if not exists idx_documents_uploaded_by_user_id_fk on public.documents (uploaded_by_user_id);
create index if not exists idx_lender_submission_attachments_document_id_fk on public.lender_submission_attachments (document_id);
create index if not exists idx_lender_submission_attachments_organization_id_fk on public.lender_submission_attachments (organization_id);
create index if not exists idx_notes_application_id_fk on public.notes (application_id);
create index if not exists idx_notes_business_id_fk on public.notes (business_id);
create index if not exists idx_notes_created_by_fk on public.notes (created_by);
create index if not exists idx_notes_owner_id_fk on public.notes (owner_id);
create index if not exists idx_offers_created_by_fk on public.offers (created_by);
create index if not exists idx_offers_funding_partner_id_fk on public.offers (funding_partner_id);
create index if not exists idx_offers_partner_submission_id_fk on public.offers (partner_submission_id);
create index if not exists idx_partner_submissions_submitted_by_fk on public.partner_submissions (submitted_by);
create index if not exists idx_tasks_application_id_fk on public.tasks (application_id);
create index if not exists idx_tasks_business_id_fk on public.tasks (business_id);
create index if not exists idx_tasks_created_by_fk on public.tasks (created_by);
create index if not exists idx_tasks_lead_id_fk on public.tasks (lead_id);
