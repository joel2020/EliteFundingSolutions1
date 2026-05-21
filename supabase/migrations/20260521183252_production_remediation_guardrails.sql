/*
  Production remediation guardrails.

  - Adds opaque public apply tokens while preserving legacy readable slugs.
  - Makes private RLS helper functions ignore archived user profiles.
  - Adds archive-list indexes for deleted directory records.
*/

alter table public.user_profiles
  add column if not exists referral_token text;

alter table public.iso_brokers
  add column if not exists application_token text;

update public.user_profiles
set referral_token = 'rep_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
where referral_token is null
  and role in ('super_admin','admin','manager','sales_rep','processor','underwriter')
  and is_active = true
  and deleted_at is null;

update public.iso_brokers
set application_token = 'iso_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
where application_token is null
  and is_active = true
  and deleted_at is null;

create unique index if not exists idx_user_profiles_referral_token
  on public.user_profiles (organization_id, referral_token)
  where referral_token is not null;

create index if not exists idx_user_profiles_referral_token_lookup
  on public.user_profiles (referral_token)
  where referral_token is not null and is_active = true and deleted_at is null;

create unique index if not exists idx_iso_brokers_application_token
  on public.iso_brokers (organization_id, application_token)
  where application_token is not null;

create index if not exists idx_iso_brokers_application_token_lookup
  on public.iso_brokers (application_token)
  where application_token is not null and is_active = true and deleted_at is null;

create index if not exists idx_funding_partners_archived_directory
  on public.funding_partners (organization_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists idx_iso_brokers_archived_directory
  on public.iso_brokers (organization_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists idx_user_profiles_archived_directory
  on public.user_profiles (organization_id, deleted_at desc)
  where deleted_at is not null;

create or replace function private.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select up.organization_id
  from public.user_profiles up
  where up.user_id = (select auth.uid())
    and up.is_active = true
    and up.deleted_at is null
  limit 1
$function$;

create or replace function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select up.role
  from public.user_profiles up
  where up.user_id = (select auth.uid())
    and up.is_active = true
    and up.deleted_at is null
  limit 1
$function$;

comment on column public.user_profiles.referral_token is 'Opaque public apply token for representative referral links. Legacy referral_slug may remain for backward compatibility.';
comment on column public.iso_brokers.application_token is 'Opaque public apply token for ISO/broker referral links. Legacy application_slug may remain for backward compatibility.';

drop policy if exists "Staff and clients can insert applications" on public.applications;
drop policy if exists "Staff can read applications in org" on public.applications;
drop policy if exists "Staff can update applications" on public.applications;
create policy "Staff can read applications in org"
  on public.applications
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer'])
  );
create policy "Staff can insert applications"
  on public.applications
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor'])
  );
create policy "Staff can update applications"
  on public.applications
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter'])
  )
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter'])
  );

drop policy if exists "Staff can insert deals" on public.deals;
drop policy if exists "Staff can read deals in org" on public.deals;
drop policy if exists "Staff can update deals" on public.deals;
create policy "Staff can read deals in org"
  on public.deals
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer'])
  );
create policy "Staff can insert deals"
  on public.deals
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep'])
  );
create policy "Staff can update deals"
  on public.deals
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter'])
  )
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter'])
  );

drop policy if exists "Staff can read documents in org" on public.documents;
drop policy if exists "Users can insert documents" on public.documents;
drop policy if exists "Staff can update documents" on public.documents;
create policy "Staff can read documents in org"
  on public.documents
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer'])
  );
create policy "Staff can insert documents"
  on public.documents
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter'])
  );
create policy "Staff can update documents"
  on public.documents
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

drop policy if exists "Staff can read funding partners in org" on public.funding_partners;
drop policy if exists "Admins can manage funding partners" on public.funding_partners;
drop policy if exists "Admins can update funding partners" on public.funding_partners;
create policy "Staff can read funding partners in org"
  on public.funding_partners
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer'])
  );
create policy "Admins can manage funding partners"
  on public.funding_partners
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager'])
  );
create policy "Admins can update funding partners"
  on public.funding_partners
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager'])
  )
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager'])
  );

drop policy if exists "Admins can read iso brokers in org" on public.iso_brokers;
drop policy if exists "Admins can insert iso brokers" on public.iso_brokers;
drop policy if exists "Admins can update iso brokers" on public.iso_brokers;
create policy "Admins can read iso brokers in org"
  on public.iso_brokers
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep'])
  );
create policy "Admins can insert iso brokers"
  on public.iso_brokers
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager'])
  );
create policy "Admins can update iso brokers"
  on public.iso_brokers
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager'])
  )
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin','manager'])
  );

drop policy if exists "Update own profile" on public.user_profiles;
drop policy if exists "Read own profile" on public.user_profiles;
drop policy if exists "Read profiles in same org" on public.user_profiles;
drop policy if exists "Admins insert profiles in org" on public.user_profiles;
drop policy if exists "Admins update profiles in org" on public.user_profiles;
create policy "Read own active profile"
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid() and is_active = true and deleted_at is null);
create policy "Read profiles in same active org"
  on public.user_profiles
  for select
  to authenticated
  using (organization_id = private.current_user_org_id());
create policy "Admins insert profiles in org"
  on public.user_profiles
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin'])
  );
create policy "Admins update profiles in org"
  on public.user_profiles
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin'])
  )
  with check (organization_id = private.current_user_org_id());
