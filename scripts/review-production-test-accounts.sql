/*
  Review candidate test/demo accounts before archival.
  Run read-only first in Supabase SQL editor or psql.
*/

select
  up.id as profile_id,
  up.user_id,
  au.id as auth_user_id,
  up.email,
  up.first_name,
  up.last_name,
  up.role,
  up.is_active,
  up.deleted_at,
  up.last_login_at,
  au.last_sign_in_at
from public.user_profiles up
left join auth.users au on au.id = up.user_id
where lower(coalesce(up.email, '')) ~ '(@example\.com$|@example\.test$|@elitefunding\.test$|^test@|^demo@|^codex)'
   or lower(coalesce(up.first_name, '')) in ('test', 'demo', 'codex')
   or lower(coalesce(up.last_name, '')) in ('test', 'demo', 'codex')
   or lower(coalesce(au.email, '')) ~ '(@example\.com$|@example\.test$|@elitefunding\.test$|^test@|^demo@|^codex)'
order by up.role, up.email;

select
  au.id as auth_user_id,
  au.email,
  au.created_at,
  au.last_sign_in_at,
  au.deleted_at
from auth.users au
left join public.user_profiles up on up.user_id = au.id
where up.id is null
  and lower(coalesce(au.email, '')) ~ '(@example\.com$|@example\.test$|@elitefunding\.test$|^test@|^demo@|^codex)'
order by au.email;
