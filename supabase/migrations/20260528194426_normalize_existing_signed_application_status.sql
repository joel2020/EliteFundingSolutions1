update public.applications
set signature_status = 'signed',
    signature_type = coalesce(signature_type, 'typed')
where organization_id = '00000000-0000-0000-0000-000000000001'
  and signed_at is not null
  and coalesce(signed_name, e_signature, '') <> ''
  and coalesce(signature_status, 'unsigned') in ('unsigned', '');

insert into public.activities (
  organization_id,
  application_id,
  deal_id,
  activity_type,
  title,
  body,
  direction,
  resource_type,
  resource_id
)
select
  a.organization_id,
  a.id,
  d.id,
  'system',
  'Signed application status repaired',
  'Existing signature evidence was normalized so the CRM shows this application as signed.',
  'internal',
  'applications',
  a.id
from public.applications a
left join public.deals d
  on d.application_id = a.id
  and d.organization_id = a.organization_id
where a.organization_id = '00000000-0000-0000-0000-000000000001'
  and a.signed_at is not null
  and coalesce(a.signed_name, a.e_signature, '') <> ''
  and a.signature_status = 'signed'
  and not exists (
    select 1
    from public.activities existing
    where existing.organization_id = a.organization_id
      and existing.application_id = a.id
      and existing.title = 'Signed application status repaired'
  );
