update public.organizations
set
  phone = '(813) 702-8787',
  website = 'https://elitefundingsolution.com',
  updated_at = now()
where name ilike '%Elite Funding%';
