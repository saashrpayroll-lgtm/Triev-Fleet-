-- ROBUST LOGIN RESOLUTION & MOBILE STANDARDIZATION
-- This script:
-- 1. Standardizes 'users' table mobile numbers to '+91' format.
-- 2. Creates a robust identifier resolution function for login.

BEGIN;

-- 1. STANDARDIZE USERS TABLE MOBILE NUMBERS
-- This ensures all users have +91 prefix, matching riders and leads.
UPDATE public.users 
SET mobile = CASE 
    WHEN mobile IS NULL OR mobile = '' THEN mobile
    WHEN mobile ~ '^\d{10}$' THEN '+91' || mobile
    WHEN mobile ~ '^91\d{10}$' THEN '+' || mobile
    WHEN mobile ~ '^\+91\d{10}$' THEN mobile
    ELSE mobile -- Fallback for unusual formats
END
WHERE mobile IS NOT NULL;

-- 2. CREATE ROBUST RESOLUTION FUNCTION
-- This replaces get_email_by_mobile and get_email_by_username with a single, smarter function.
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier TEXT)
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_mobile TEXT;
    v_resolved_email TEXT;
BEGIN
    -- Try Email match first (Case Insensitive)
    SELECT email INTO v_resolved_email
    FROM users
    WHERE email ILIKE p_identifier
    LIMIT 1;

    IF v_resolved_email IS NOT NULL THEN
        RETURN v_resolved_email;
    END IF;

    -- Clean Identifier for Mobile (Extract digits)
    v_clean_mobile := regexp_replace(p_identifier, '[^0-9]', '', 'g');

    -- Try Mobile match (Handle various formats)
    IF length(v_clean_mobile) >= 10 THEN
        -- Match last 10 digits
        SELECT email INTO v_resolved_email
        FROM users
        WHERE right(regexp_replace(mobile, '[^0-9]', '', 'g'), 10) = right(v_clean_mobile, 10)
        LIMIT 1;
        
        IF v_resolved_email IS NOT NULL THEN
            RETURN v_resolved_email;
        END IF;
    END IF;

    -- Try Username / User ID match (Case Insensitive)
    SELECT email INTO v_resolved_email
    FROM users
    WHERE username ILIKE p_identifier OR user_id ILIKE p_identifier
    LIMIT 1;

    RETURN v_resolved_email; -- May be NULL if not found
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(TEXT) TO anon, authenticated, service_role;

COMMIT;
