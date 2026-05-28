create or replace function private.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select up.id
  from public.user_profiles up
  where up.user_id = (select auth.uid())
    and up.is_active = true
  limit 1
$$;

revoke all on function private.current_user_profile_id() from public;
grant execute on function private.current_user_profile_id() to authenticated;
grant execute on function private.current_user_profile_id() to service_role;

comment on function private.current_user_profile_id() is 'Returns the active authenticated CRM profile id for assignment-aware RLS checks.';

create or replace function private.current_user_can_access_deal(target_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.deals d
    where d.id = target_deal_id
      and d.organization_id = private.current_user_org_id()
      and d.deleted_at is null
      and (
        private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
        or private.current_user_profile_id() = any (array[d.assigned_user_id, d.junior_closer_id, d.senior_closer_id, d.referred_by_user_profile_id])
      )
  )
$$;

create or replace function private.current_user_can_access_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications a
    where a.id = target_application_id
      and a.organization_id = private.current_user_org_id()
      and a.deleted_at is null
      and (
        private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
        or a.assigned_user_id = private.current_user_profile_id()
        or a.referred_by_user_profile_id = private.current_user_profile_id()
        or exists (
          select 1
          from public.deals d
          where d.application_id = a.id
            and d.organization_id = a.organization_id
            and private.current_user_can_access_deal(d.id)
        )
      )
  )
$$;

create or replace function private.current_user_can_access_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = target_business_id
      and b.organization_id = private.current_user_org_id()
      and b.deleted_at is null
      and (
        private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
        or exists (
          select 1
          from public.deals d
          where d.business_id = b.id
            and d.organization_id = b.organization_id
            and private.current_user_can_access_deal(d.id)
        )
        or exists (
          select 1
          from public.applications a
          where a.business_id = b.id
            and a.organization_id = b.organization_id
            and private.current_user_can_access_application(a.id)
        )
      )
  )
$$;

revoke all on function private.current_user_can_access_deal(uuid) from public;
revoke all on function private.current_user_can_access_application(uuid) from public;
revoke all on function private.current_user_can_access_business(uuid) from public;
grant execute on function private.current_user_can_access_deal(uuid) to authenticated;
grant execute on function private.current_user_can_access_application(uuid) to authenticated;
grant execute on function private.current_user_can_access_business(uuid) to authenticated;
grant execute on function private.current_user_can_access_deal(uuid) to service_role;
grant execute on function private.current_user_can_access_application(uuid) to service_role;
grant execute on function private.current_user_can_access_business(uuid) to service_role;

drop policy if exists "Staff can read deals in org" on public.deals;
create policy "Assignment aware CRM deal reads"
  on public.deals
  for select
  to authenticated
  using (private.current_user_can_access_deal(id));

drop policy if exists "Staff can update deals" on public.deals;
create policy "Assignment aware CRM deal updates"
  on public.deals
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and deleted_at is null
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter'])
      or assigned_user_id = private.current_user_profile_id()
      or junior_closer_id = private.current_user_profile_id()
      or senior_closer_id = private.current_user_profile_id()
    )
  )
  with check (organization_id = private.current_user_org_id());

drop policy if exists "Staff can read applications in org" on public.applications;
create policy "Assignment aware CRM application reads"
  on public.applications
  for select
  to authenticated
  using (
    private.current_user_can_access_application(id)
    or business_id in (
      select b.id
      from public.businesses b
      join public.business_owners bo on bo.business_id = b.id
      join public.owners o on o.id = bo.owner_id
      where o.user_id = (select auth.uid())
    )
  );

drop policy if exists "Staff can update applications" on public.applications;
create policy "Assignment aware CRM application updates"
  on public.applications
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and deleted_at is null
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter'])
      or assigned_user_id = private.current_user_profile_id()
      or referred_by_user_profile_id = private.current_user_profile_id()
    )
  )
  with check (organization_id = private.current_user_org_id());

drop policy if exists "Admins can select leads in org" on public.leads;
create policy "Assignment aware CRM lead reads"
  on public.leads
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and deleted_at is null
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
      or assigned_user_id = private.current_user_profile_id()
      or referred_by_user_profile_id = private.current_user_profile_id()
      or exists (
        select 1
        from public.deals d
        where d.lead_id = leads.id
          and d.organization_id = leads.organization_id
          and private.current_user_can_access_deal(d.id)
      )
    )
  );

drop policy if exists "Staff can update leads" on public.leads;
create policy "Assignment aware CRM lead updates"
  on public.leads
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and deleted_at is null
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter'])
      or assigned_user_id = private.current_user_profile_id()
      or referred_by_user_profile_id = private.current_user_profile_id()
    )
  )
  with check (organization_id = private.current_user_org_id());

drop policy if exists "Staff can select businesses in org" on public.businesses;
create policy "Assignment aware CRM business reads"
  on public.businesses
  for select
  to authenticated
  using (
    private.current_user_can_access_business(id)
    or id in (
      select b.id
      from public.businesses b
      join public.business_owners bo on bo.business_id = b.id
      join public.owners o on o.id = bo.owner_id
      where o.user_id = (select auth.uid())
    )
  );

drop policy if exists "Staff can select owners in org" on public.owners;
create policy "Assignment aware CRM owner reads"
  on public.owners
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
      or user_id = (select auth.uid())
      or exists (
        select 1
        from public.business_owners bo
        where bo.owner_id = owners.id
          and bo.organization_id = owners.organization_id
          and private.current_user_can_access_business(bo.business_id)
      )
    )
  );

drop policy if exists "Staff can read documents in org" on public.documents;
create policy "Assignment aware CRM document reads"
  on public.documents
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
      or (deal_id is not null and private.current_user_can_access_deal(deal_id))
      or (application_id is not null and private.current_user_can_access_application(application_id))
    )
  );

drop policy if exists "Staff can read submissions in org" on public.partner_submissions;
create policy "Assignment aware CRM lender submission reads"
  on public.partner_submissions
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
      or private.current_user_can_access_deal(deal_id)
    )
  );

drop policy if exists "Staff can read activities in org" on public.activities;
create policy "Assignment aware CRM activity reads"
  on public.activities
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
      or (deal_id is not null and private.current_user_can_access_deal(deal_id))
      or (application_id is not null and private.current_user_can_access_application(application_id))
      or (business_id is not null and private.current_user_can_access_business(business_id))
      or (lead_id is not null and exists (
        select 1 from public.leads l
        where l.id = activities.lead_id
          and l.organization_id = activities.organization_id
          and (l.assigned_user_id = private.current_user_profile_id() or l.referred_by_user_profile_id = private.current_user_profile_id())
      ))
    )
  );

drop policy if exists "Staff can read notes in org" on public.notes;
drop policy if exists "Staff can manage notes" on public.notes;
create policy "Assignment aware CRM note reads"
  on public.notes
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
      or (deal_id is not null and private.current_user_can_access_deal(deal_id))
      or (application_id is not null and private.current_user_can_access_application(application_id))
      or (business_id is not null and private.current_user_can_access_business(business_id))
    )
  );

create policy "Assignment aware CRM note writes"
  on public.notes
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter'])
      or (deal_id is not null and private.current_user_can_access_deal(deal_id))
      or (application_id is not null and private.current_user_can_access_application(application_id))
      or (business_id is not null and private.current_user_can_access_business(business_id))
    )
  );

drop policy if exists "Partners can read offers" on public.offers;
drop policy if exists "Staff can read offers in org" on public.offers;
create policy "Assignment aware CRM offer reads"
  on public.offers
  for select
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and (
      private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
      or private.current_user_can_access_deal(deal_id)
    )
  );

drop policy if exists "CRM staff can read org application documents" on storage.objects;
create policy "CRM staff can read accessible application documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1
      from public.documents d
      where d.storage_path = storage.objects.name
        and d.organization_id = private.current_user_org_id()
        and (
          private.current_user_role() = any (array['super_admin','admin','manager','processor','underwriter','viewer'])
          or (d.deal_id is not null and private.current_user_can_access_deal(d.deal_id))
          or (d.application_id is not null and private.current_user_can_access_application(d.application_id))
        )
    )
  );

comment on policy "CRM staff can read accessible application documents" on storage.objects is 'CRM storage reads are scoped to documents visible to the current role or assigned rep, not every object in the organization.';
