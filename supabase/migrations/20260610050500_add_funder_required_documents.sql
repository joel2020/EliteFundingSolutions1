alter table public.funding_partners
  add column if not exists required_documents text[] default '{}';

comment on column public.funding_partners.required_documents is
  'Funder-specific document types required for package planning, upload classification, and send-to-funder defaults.';
