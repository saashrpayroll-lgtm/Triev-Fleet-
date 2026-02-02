-- Secure User Lookup Function for Forgot Password
-- This allows finding a user's ID by mobile or email without exposing the entire users table to the public

CREATE OR REPLACE FUNCTION get_user_by_recovery_contact(p_contact TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  mobile TEXT,
  email TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin)
SET search_path = public -- Secure search path
AS $$
BEGIN
  RETURN QUERY 
  SELECT u.id, u.full_name, u.mobile, u.email
  FROM users u
  WHERE 
    -- Match exact mobile
    u.mobile = p_contact
    -- Match mobile with +91
    OR u.mobile = '+91' || p_contact
    -- Match mobile if input has +91
    OR u.mobile = REPLACE(p_contact, '+91', '')
    -- Match email (case insensitive)
    OR u.email ILIKE p_contact;
END;
$$;

-- Grant execute permission to everyone (including unauthenticated users)
GRANT EXECUTE ON FUNCTION get_user_by_recovery_contact(TEXT) TO anon, authenticated, service_role;
