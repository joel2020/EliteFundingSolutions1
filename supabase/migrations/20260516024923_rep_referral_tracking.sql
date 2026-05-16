/*
  Rep referral tracking for public funding applications.

  Each internal rep can have a stable referral slug for URLs like
  /apply/rep/jane-smith. Public submissions resolve that slug server-side
  and attach the application, lead, and deal to the rep.
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_slug text;

UPDATE public.user_profiles
SET referral_slug = lower(trim(both '-' from regexp_replace(
  concat_ws('-', nullif(first_name, ''), nullif(last_name, ''), left(id::text, 8)),
  '[^a-zA-Z0-9]+',
  '-',
  'g'
)))
WHERE referral_slug IS NULL
  AND role IN ('super_admin','admin','manager','sales_rep','processor','underwriter');

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_referral_slug
  ON public.user_profiles (organization_id, referral_slug)
  WHERE referral_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_referral_lookup
  ON public.user_profiles (referral_slug)
  WHERE referral_slug IS NOT NULL AND is_active = true;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referral_path text,
  ADD COLUMN IF NOT EXISTS referred_by_user_profile_id uuid REFERENCES public.user_profiles(id);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referral_path text,
  ADD COLUMN IF NOT EXISTS referred_by_user_profile_id uuid REFERENCES public.user_profiles(id);

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referral_path text,
  ADD COLUMN IF NOT EXISTS referred_by_user_profile_id uuid REFERENCES public.user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_applications_referred_by
  ON public.applications (referred_by_user_profile_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_referred_by
  ON public.leads (referred_by_user_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_referred_by
  ON public.deals (referred_by_user_profile_id, created_at DESC);
