/*
  CRM access and invitation management.

  Adds CRM-owned invite tracking, access entity linkage for funder/ISO users,
  role/permission reference tables, and RLS policies for external deal access.
*/

do $$
declare
  constraint_name text;
begin
  alter table public.user_profiles drop constraint if exists user_profiles_role_check;

  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.user_profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role IN%';

  if constraint_name is not null then
    execute format('alter table public.user_profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in (
    'super_admin','admin','manager','sales_rep','underwriter','processor',
    'funder','iso_broker','broker','referral_partner','client','viewer'
  ));

alter table public.user_profiles
  add column if not exists company_name text,
  add column if not exists access_entity_type text not null default 'internal'
    check (access_entity_type in ('internal','funding_partner','iso_broker','referral_partner','broker','client')),
  add column if not exists access_entity_id uuid,
  add column if not exists invite_status text not null default 'active'
    check (invite_status in ('not_invited','pending','sent','accepted','expired','revoked','failed','active')),
  add column if not exists invited_at timestamptz,
  add column if not exists invite_expires_at timestamptz,
  add column if not exists invite_accepted_at timestamptz,
  add column if not exists access_revoked_at timestamptz,
  add column if not exists access_revoked_by uuid references public.user_profiles(id) on delete set null;

update public.user_profiles
set access_entity_type = case
    when role = 'funder' then 'funding_partner'
    when role in ('iso_broker','broker') then 'iso_broker'
    when role = 'referral_partner' then 'referral_partner'
    when role = 'client' then 'client'
    else 'internal'
  end,
  invite_status = case
    when last_login_at is not null then 'accepted'
    when user_id is not null then 'active'
    else 'not_invited'
  end
where access_entity_type is null
   or invite_status is null
   or invite_status = 'active';

create index if not exists idx_user_profiles_access_entity
  on public.user_profiles (organization_id, access_entity_type, access_entity_id)
  where deleted_at is null;

create index if not exists idx_user_profiles_invite_status
  on public.user_profiles (organization_id, invite_status, invited_at desc)
  where deleted_at is null;

create table if not exists public.crm_role_catalog (
  key text primary key,
  label text not null,
  category text not null check (category in ('internal','external','portal')),
  description text not null,
  is_system boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.crm_permission_catalog (
  key text primary key,
  label text not null,
  description text not null,
  created_at timestamptz default now()
);

create table if not exists public.crm_role_permission_catalog (
  role_key text not null references public.crm_role_catalog(key) on delete cascade,
  permission_key text not null references public.crm_permission_catalog(key) on delete cascade,
  created_at timestamptz default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.crm_access_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  company_name text,
  role text not null,
  permissions text[] not null default '{}',
  access_entity_type text not null default 'internal'
    check (access_entity_type in ('internal','funding_partner','iso_broker','referral_partner','broker','client')),
  access_entity_id uuid,
  status text not null default 'pending'
    check (status in ('pending','sent','accepted','expired','revoked','failed')),
  auth_user_id uuid references auth.users(id) on delete set null,
  user_profile_id uuid references public.user_profiles(id) on delete set null,
  invited_by uuid references public.user_profiles(id) on delete set null,
  resent_count integer not null default 0,
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.user_profiles(id) on delete set null,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_crm_access_invites_org_status
  on public.crm_access_invites (organization_id, status, created_at desc);

create index if not exists idx_crm_access_invites_email
  on public.crm_access_invites (organization_id, lower(email), created_at desc);

create index if not exists idx_crm_access_invites_profile
  on public.crm_access_invites (user_profile_id)
  where user_profile_id is not null;

alter table public.crm_role_catalog enable row level security;
alter table public.crm_permission_catalog enable row level security;
alter table public.crm_role_permission_catalog enable row level security;
alter table public.crm_access_invites enable row level security;

drop trigger if exists set_crm_access_invites_updated_at on public.crm_access_invites;
create trigger set_crm_access_invites_updated_at
  before update on public.crm_access_invites
  for each row execute function public.set_updated_at();

insert into public.crm_role_catalog (key, label, category, description) values
  ('super_admin','Super Admin','internal','Full platform ownership and all system settings.'),
  ('admin','Admin','internal','Manage CRM workflow, users, funders, ISOs, documents, and sensitive data.'),
  ('manager','Manager','internal','Manage team CRM workflow without full system ownership.'),
  ('sales_rep','Internal Team Member','internal','Manage assigned leads and deals.'),
  ('processor','Processor','internal','Manage documents, applications, tasks, and underwriting support.'),
  ('underwriter','Underwriter','internal','Review files, offers, underwriting, and risk workflow.'),
  ('funder','Funder','external','View only submitted deals and documents for their funding company.'),
  ('iso_broker','ISO Partner','external','Submit and track their own ISO submissions.'),
  ('broker','Broker','external','Submit and track their own broker submissions.'),
  ('referral_partner','Referral Partner','external','Submit referrals and view allowed referred deal status.'),
  ('viewer','Read-only User','internal','Read-only CRM visibility.'),
  ('client','Client','portal','Customer portal access only.')
on conflict (key) do update set
  label = excluded.label,
  category = excluded.category,
  description = excluded.description;

insert into public.crm_permission_catalog (key, label, description) values
  ('manage_users','Manage users','Invite, edit, disable, revoke, and resend user access.'),
  ('manage_funders','Manage funders','Create funder organizations and invite funder users.'),
  ('manage_isos','Manage ISOs','Create ISO/broker organizations and invite partner users.'),
  ('view_sensitive','View sensitive application data','Reveal SSN, EIN, DOB, and other protected fields.'),
  ('upload_documents','Upload documents','Upload deal and application documents.'),
  ('edit_deals','Edit deals','Create and update CRM deal records.'),
  ('send_to_funders','Send deals to funders','Share deal packages with selected funders.'),
  ('manage_settings','Manage settings','Manage CRM settings and system configuration.'),
  ('submit_applications','Submit applications','Submit applications or leads into the CRM.'),
  ('view_shared_deals','View shared deals','View only deals explicitly shared with the user organization.')
on conflict (key) do update set label = excluded.label, description = excluded.description;

insert into public.crm_role_permission_catalog (role_key, permission_key) values
  ('super_admin','manage_users'), ('super_admin','manage_funders'), ('super_admin','manage_isos'), ('super_admin','view_sensitive'), ('super_admin','upload_documents'), ('super_admin','edit_deals'), ('super_admin','send_to_funders'), ('super_admin','manage_settings'),
  ('admin','manage_users'), ('admin','manage_funders'), ('admin','manage_isos'), ('admin','view_sensitive'), ('admin','upload_documents'), ('admin','edit_deals'), ('admin','send_to_funders'), ('admin','manage_settings'),
  ('manager','upload_documents'), ('manager','edit_deals'), ('manager','send_to_funders'),
  ('sales_rep','upload_documents'), ('sales_rep','edit_deals'), ('sales_rep','send_to_funders'),
  ('processor','upload_documents'), ('processor','edit_deals'),
  ('underwriter','upload_documents'),
  ('funder','view_shared_deals'),
  ('iso_broker','submit_applications'), ('iso_broker','upload_documents'), ('iso_broker','view_shared_deals'),
  ('broker','submit_applications'), ('broker','upload_documents'), ('broker','view_shared_deals'),
  ('referral_partner','submit_applications'), ('referral_partner','view_shared_deals'),
  ('viewer','view_shared_deals')
on conflict do nothing;

drop policy if exists "Admins read CRM access invites" on public.crm_access_invites;
create policy "Admins read CRM access invites"
  on public.crm_access_invites for select to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin'])
  );

drop policy if exists "Admins manage CRM access invites" on public.crm_access_invites;
create policy "Admins manage CRM access invites"
  on public.crm_access_invites for all to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin'])
  )
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin'])
  );

drop policy if exists "Staff read CRM role catalog" on public.crm_role_catalog;
create policy "Staff read CRM role catalog"
  on public.crm_role_catalog for select to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer']));

drop policy if exists "Staff read CRM permission catalog" on public.crm_permission_catalog;
create policy "Staff read CRM permission catalog"
  on public.crm_permission_catalog for select to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer']));

drop policy if exists "Staff read CRM role permissions" on public.crm_role_permission_catalog;
create policy "Staff read CRM role permissions"
  on public.crm_role_permission_catalog for select to authenticated
  using (private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer']));

drop policy if exists "Read profiles in same active org" on public.user_profiles;
create policy "Read profiles in same active org"
  on public.user_profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      organization_id = private.current_user_org_id()
      and private.current_user_role() = any (array['super_admin','admin','manager','sales_rep','processor','underwriter','viewer'])
    )
  );

drop policy if exists "External funders can read own funding partner" on public.funding_partners;
create policy "External funders can read own funding partner"
  on public.funding_partners
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and id in (
      select up.access_entity_id
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = 'funder'
        and up.access_entity_type = 'funding_partner'
    )
  );

drop policy if exists "External ISOs can read own broker org" on public.iso_brokers;
create policy "External ISOs can read own broker org"
  on public.iso_brokers
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and id in (
      select up.access_entity_id
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = any (array['iso_broker','broker','referral_partner'])
        and up.access_entity_type in ('iso_broker','referral_partner','broker')
    )
  );

drop policy if exists "External funders can read submitted deals" on public.deals;
create policy "External funders can read submitted deals"
  on public.deals
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and exists (
      select 1
      from public.user_profiles up
      join public.partner_submissions ps
        on ps.funding_partner_id = up.access_entity_id
       and ps.deal_id = deals.id
       and ps.organization_id = deals.organization_id
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = 'funder'
        and up.access_entity_type = 'funding_partner'
    )
  );

drop policy if exists "External partners can read own submitted deals" on public.deals;
create policy "External partners can read own submitted deals"
  on public.deals
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
        and up.access_entity_id = deals.iso_broker_id
    )
  );

drop policy if exists "External funders can read own submissions" on public.partner_submissions;
create policy "External funders can read own submissions"
  on public.partner_submissions
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and funding_partner_id in (
      select up.access_entity_id
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = 'funder'
        and up.access_entity_type = 'funding_partner'
    )
  );

drop policy if exists "External funders can update own submission decisions" on public.partner_submissions;
create policy "External funders can update own submission decisions"
  on public.partner_submissions
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and funding_partner_id in (
      select up.access_entity_id
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = 'funder'
        and up.access_entity_type = 'funding_partner'
    )
  )
  with check (
    organization_id = private.current_user_org_id()
    and funding_partner_id in (
      select up.access_entity_id
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = 'funder'
        and up.access_entity_type = 'funding_partner'
    )
  );

drop policy if exists "External funders can read shared documents" on public.documents;
create policy "External funders can read shared documents"
  on public.documents
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and exists (
      select 1
      from public.user_profiles up
      join public.partner_submissions ps
        on ps.funding_partner_id = up.access_entity_id
       and ps.deal_id = documents.deal_id
       and ps.organization_id = documents.organization_id
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = 'funder'
        and up.access_entity_type = 'funding_partner'
    )
  );

drop policy if exists "External partners can read own deal documents" on public.documents;
create policy "External partners can read own deal documents"
  on public.documents
  for select
  to authenticated
  using (
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

drop policy if exists "External funders can read own offers" on public.offers;
create policy "External funders can read own offers"
  on public.offers
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and funding_partner_id in (
      select up.access_entity_id
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.is_active = true
        and up.deleted_at is null
        and up.role = 'funder'
        and up.access_entity_type = 'funding_partner'
    )
  );

grant select on public.crm_role_catalog to authenticated;
grant select on public.crm_permission_catalog to authenticated;
grant select on public.crm_role_permission_catalog to authenticated;
grant select, insert, update on public.crm_access_invites to authenticated;

comment on table public.crm_access_invites is 'CRM-owned source of truth for access invitations, status, role, permissions, and organization linkage.';
comment on column public.user_profiles.access_entity_type is 'The organization/access scope for external CRM users: funding partner, ISO/broker, referral partner, client, or internal.';
comment on column public.user_profiles.access_entity_id is 'Funding partner or ISO/broker record that scopes external CRM access.';

