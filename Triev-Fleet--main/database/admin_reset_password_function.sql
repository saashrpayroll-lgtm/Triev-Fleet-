-- Create a secure function to allow Admins to reset user passwords
-- This bypasses the need for Service Role Key in the frontend

-- Enable pgcrypto for password hashing if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the function
CREATE OR REPLACE FUNCTION admin_reset_password_v2(target_user_id UUID, new_password TEXT)
RETURNS VOID
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin)
SET search_path = public, auth, extensions -- Secure search path
AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- 1. Check if the executing user is an Admin
  -- (We check the public.users table for the role of the caller)
  SELECT role INTO current_user_role
  FROM public.users
  WHERE id = auth.uid();

  IF current_user_role IS NULL OR current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Permission Denied: User (ID: %) has role "%". Expected "admin".', auth.uid(), COALESCE(current_user_role, 'NULL');
  END IF;

  -- 2. Update the user's password in auth.users
  -- Supabase stores passwords in auth.users.encrypted_password
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = target_user_id;

  -- 3. Also update public.users to force password change
  UPDATE public.users
  SET force_password_change = TRUE,
      last_password_change = NOW()
  WHERE id = target_user_id;

END;
$$ LANGUAGE plpgsql;
