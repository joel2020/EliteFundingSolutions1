/*
  # Revoke anon/authenticated Execute on SECURITY DEFINER Functions

  ## Overview
  The previous migration revoked from PUBLIC but Supabase had already granted EXECUTE
  explicitly to the `anon` and `authenticated` roles. This migration revokes those
  explicit grants directly.

  ## Changes

  1. `get_dashboard_metrics` — Revoke from `anon`. Keep `authenticated` (legitimate API call).
  2. `handle_new_user` — Revoke from both `anon` and `authenticated`. This is a trigger-only
     function and should never be callable via the REST API.
  3. `repair_user_profile` — Revoke from `anon`. Keep `authenticated` (legitimate API call).
*/

-- get_dashboard_metrics: block anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.get_dashboard_metrics(uuid) FROM anon;

-- handle_new_user: block both anon and authenticated (trigger-only function)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- repair_user_profile: block anon, keep authenticated
REVOKE EXECUTE ON FUNCTION public.repair_user_profile(uuid, text, uuid, text) FROM anon;
