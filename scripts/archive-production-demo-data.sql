/*
  Archive the original demo seed businesses and deals.

  Review scripts/review-production-demo-data.sql first.
  This preserves rows and references by setting deleted_at instead of deleting.
*/

begin;

update public.deals
set deleted_at = now(), updated_at = now()
where deleted_at is null
  and id in (
    '33333333-0000-0000-0000-000000000001',
    '33333333-0000-0000-0000-000000000002',
    '33333333-0000-0000-0000-000000000003',
    '33333333-0000-0000-0000-000000000004'
  )
returning id, title, deleted_at;

update public.businesses
set deleted_at = now(), updated_at = now()
where deleted_at is null
  and id in (
    '11111111-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000004'
  )
returning id, legal_name, deleted_at;

rollback;

/*
  After reviewing the returned rows, change rollback to commit.
*/
