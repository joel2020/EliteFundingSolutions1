/*
  Review demo seed records that were inserted by supabase/migrations/20260511204844_008_seed_data.sql.
*/

select 'businesses' as table_name, id, legal_name as name, email, deleted_at
from public.businesses
where id in (
  '11111111-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000002',
  '11111111-0000-0000-0000-000000000003',
  '11111111-0000-0000-0000-000000000004'
)
union all
select 'deals' as table_name, id, title as name, null::text as email, deleted_at
from public.deals
where id in (
  '33333333-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000002',
  '33333333-0000-0000-0000-000000000003',
  '33333333-0000-0000-0000-000000000004'
)
order by table_name, name;
