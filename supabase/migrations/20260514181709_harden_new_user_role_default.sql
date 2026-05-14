-- Harden auth profile creation: raw_user_meta_data is user-controlled, so it
-- must not be allowed to assign internal CRM roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.user_profiles (user_id, organization_id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    v_org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'client'
  )
  ON CONFLICT (user_id, organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
