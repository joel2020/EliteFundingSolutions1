/*
  ISO/funder partner workspace hardening.

  External partner users need enough read access to use the CRM workspace without
  seeing unrelated records. These policies stay scoped through user_profiles
  access_entity_id and do not grant management permissions.
*/

alter table public.documents
  add column if not exists visibility text not null default 'internal'
    check (visibility in ('internal','shared','funder','client'));

drop policy if exists "External partners can read own applications" on public.applications;
create policy "External partners can read own applications"
  on public.applications
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = any (array['iso_broker','broker','referral_partner'])
        and up.access_entity_id = applications.iso_broker_id
    )
  );

drop policy if exists "External partners can read own submitted businesses" on public.businesses;
create policy "External partners can read own submitted businesses"
  on public.businesses
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and exists (
      select 1
      from public.user_profiles up
      join public.deals d
        on d.business_id = businesses.id
       and d.organization_id = businesses.organization_id
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = any (array['iso_broker','broker','referral_partner'])
        and up.access_entity_id = d.iso_broker_id
    )
  );

drop policy if exists "External partners can insert own deal documents" on public.documents;
create policy "External partners can insert own deal documents"
  on public.documents
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and exists (
      select 1
      from public.user_profiles up
      join public.deals d
        on d.id = documents.deal_id
       and d.organization_id = documents.organization_id
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = any (array['iso_broker','broker','referral_partner'])
        and up.access_entity_id = d.iso_broker_id
    )
  );

drop policy if exists "External partners can read shared notes" on public.notes;
create policy "External partners can read shared notes"
  on public.notes
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and coalesce(is_internal, false) = false
    and exists (
      select 1
      from public.user_profiles up
      join public.deals d
        on d.id = notes.deal_id
       and d.organization_id = notes.organization_id
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = any (array['iso_broker','broker','referral_partner'])
        and up.access_entity_id = d.iso_broker_id
    )
  );

create index if not exists idx_documents_visibility
  on public.documents (organization_id, visibility, created_at desc);
