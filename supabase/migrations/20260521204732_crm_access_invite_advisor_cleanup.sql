/*
  Clean up advisor findings introduced by CRM access invite management.
*/

create index if not exists idx_crm_access_invites_auth_user_id
  on public.crm_access_invites (auth_user_id)
  where auth_user_id is not null;

create index if not exists idx_crm_access_invites_invited_by
  on public.crm_access_invites (invited_by)
  where invited_by is not null;

create index if not exists idx_crm_access_invites_revoked_by
  on public.crm_access_invites (revoked_by)
  where revoked_by is not null;

create index if not exists idx_crm_role_permission_catalog_permission_key
  on public.crm_role_permission_catalog (permission_key);

drop policy if exists "Admins manage CRM access invites" on public.crm_access_invites;

create policy "Admins insert CRM access invites"
  on public.crm_access_invites
  for insert
  to authenticated
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin'])
  );

create policy "Admins update CRM access invites"
  on public.crm_access_invites
  for update
  to authenticated
  using (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin'])
  )
  with check (
    organization_id = private.current_user_org_id()
    and private.current_user_role() = any (array['super_admin','admin'])
  );
