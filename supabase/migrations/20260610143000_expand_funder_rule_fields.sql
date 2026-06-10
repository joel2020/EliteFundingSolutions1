alter table public.funding_partners
  add column if not exists preferred_industries text[] default '{}',
  add column if not exists min_credit_score integer,
  add column if not exists max_existing_positions integer,
  add column if not exists max_negative_days integer,
  add column if not exists max_nsf_count integer,
  add column if not exists preferred_submission_method text,
  add column if not exists criteria_notes text;

update public.funding_partners
set min_credit_score = null
where min_credit_score is not null
  and (min_credit_score < 300 or min_credit_score > 850);

alter table public.funding_partners
  drop constraint if exists funding_partners_min_credit_score_check,
  add constraint funding_partners_min_credit_score_check
    check (min_credit_score is null or (min_credit_score >= 300 and min_credit_score <= 850));

alter table public.funding_partners
  drop constraint if exists funding_partners_preferred_submission_method_check,
  add constraint funding_partners_preferred_submission_method_check
    check (
      preferred_submission_method is null
      or preferred_submission_method in ('email', 'portal', 'api', 'manual')
    );

comment on column public.funding_partners.preferred_industries is
  'Funder-preferred industries used for dynamic funder matching and AI package recommendations.';

comment on column public.funding_partners.min_credit_score is
  'Minimum owner credit/FICO threshold when tracked by the funder.';

comment on column public.funding_partners.criteria_notes is
  'Detailed funder criteria and underwriting rules used by staff, document classification, and AI recommendations.';
