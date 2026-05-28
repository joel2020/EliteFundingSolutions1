ALTER TABLE public.funding_partners
  ADD COLUMN IF NOT EXISTS restricted_states text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_industries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bonus_notes text;
