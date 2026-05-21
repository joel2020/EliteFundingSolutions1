alter table public.funding_partners
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.user_profiles(id) on delete set null;

alter table public.iso_brokers
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.user_profiles(id) on delete set null;

alter table public.user_profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.user_profiles(id) on delete set null;

create index if not exists idx_funding_partners_active_directory
  on public.funding_partners (organization_id, name)
  where deleted_at is null;

create index if not exists idx_iso_brokers_active_directory
  on public.iso_brokers (organization_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_user_profiles_active_directory
  on public.user_profiles (organization_id, first_name, last_name)
  where deleted_at is null;
