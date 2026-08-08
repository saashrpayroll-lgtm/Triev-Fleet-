-- ============================================================================
-- ADMIN PASSWORD RESET SCRIPT
-- ============================================================================
-- USE: Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- This resets a user's password directly in the auth system.
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  STEP 1: Change the email and new password below, then run the script  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ⚠️ CHANGE THESE TWO VALUES:
DO $$
DECLARE
    target_email TEXT := 'saunvir@gmail.com';     -- ← Change to the user's email
    new_password TEXT := 'Admin@123';             -- ← Change to your desired password
BEGIN
    -- Update the password in auth.users
    UPDATE auth.users
    SET 
        encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = now(),
        password_hash = NULL  -- Clear any old hash format
    WHERE email = target_email;

    -- Also clear force_password_change flag in public.users
    UPDATE public.users 
    SET force_password_change = false
    WHERE email = target_email;

    IF NOT FOUND THEN
        RAISE NOTICE 'User with email % not found in public.users (but auth password may still be updated)', target_email;
    END IF;

    RAISE NOTICE 'Password reset complete for %', target_email;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Check the user exists in both tables
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 
    au.id,
    au.email,
    pu.role,
    pu.status,
    pu.full_name,
    pu.username,
    pu.force_password_change
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.email = 'saunvir@gmail.com';  -- ← Same email as above

-- ═══════════════════════════════════════════════════════════════════════════
-- BONUS: See ALL users and their auth status
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 
    au.email,
    pu.full_name,
    pu.role,
    pu.status,
    pu.username,
    CASE WHEN pu.id IS NULL THEN '❌ MISSING PROFILE' ELSE '✅ OK' END AS profile_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC;
