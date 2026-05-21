/*
  Archive obvious test/demo CRM profiles.

  Review scripts/review-production-test-accounts.sql first.
  This does not delete auth.users rows. It deactivates and archives matching CRM profiles
  so app auth, middleware, server routes, and RLS deny CRM/portal access.
*/

begin;

with candidates as (
  select up.id
  from public.user_profiles up
  left join auth.users au on au.id = up.user_id
  where up.deleted_at is null
    and (
      lower(coalesce(up.email, '')) ~ '(@example\.com$|@example\.test$|@elitefunding\.test$|^test@|^demo@|^codex)'
      or lower(coalesce(up.first_name, '')) in ('test', 'demo', 'codex')
      or lower(coalesce(up.last_name, '')) in ('test', 'demo', 'codex')
      or lower(coalesce(au.email, '')) ~ '(@example\.com$|@example\.test$|@elitefunding\.test$|^test@|^demo@|^codex)'
    )
)
update public.user_profiles up
set
  is_active = false,
  deleted_at = now(),
  deleted_by = null,
  updated_at = now()
from candidates
where up.id = candidates.id
returning up.id, up.email, up.role, up.is_active, up.deleted_at;

rollback;

/*
  After reviewing the returned rows, change rollback to commit.
*/
