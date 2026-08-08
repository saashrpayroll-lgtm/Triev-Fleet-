-- ============================================================================
-- FIX: ALL PANELS LOGIN FAILURE ("Profile Not Found" for Admin, TL, RM)
-- ============================================================================
-- ROOT CAUSE: The RLS policies on public.users table are either missing or
-- were accidentally dropped during a recent migration. Without the
-- "Users can view their own profile" policy, NO user can read their
-- own row from public.users after authenticating, causing the app
-- to fall back to role='guest' → "Profile Not Found".
--
-- This script:
-- 1. Re-creates SECURITY DEFINER helper functions (bypass RLS safely)
-- 2. Re-applies ALL necessary SELECT policies on public.users
-- 3. Ensures UPDATE policy exists (users need to update their own profile)
-- 4. Syncs any missing user profiles from auth.users → public.users
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 0: Ensure role constraint allows all 3 roles
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    conname text;
BEGIN
    FOR conname IN 
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public' 
          AND rel.relname = 'users'
          AND con.contype = 'c' 
          AND pg_get_constraintdef(con.oid) ILIKE '%role%'
    LOOP
        EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT ' || quote_ident(conname);
    END LOOP;
END
$$;

ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'teamLeader', 'reportingManager'));

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: SECURITY DEFINER helper functions (prevent RLS recursion)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_team_leader()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'teamLeader'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_reporting_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'reportingManager'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Enable RLS and re-create ALL SELECT policies on public.users
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- *** CRITICAL: Every user MUST be able to read their own row ***
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Admins can view ALL users (for user management)
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (public.is_admin());

-- Team Leaders can view other Team Leaders (for leaderboard)
DROP POLICY IF EXISTS "Team Leaders can view other Team Leaders" ON public.users;
CREATE POLICY "Team Leaders can view other Team Leaders"
ON public.users
FOR SELECT
USING (
  public.is_team_leader()
  AND role = 'teamLeader'
);

-- Reporting Managers can view all users (for RM panel)
DROP POLICY IF EXISTS "Reporting Managers can view all users" ON public.users;
CREATE POLICY "Reporting Managers can view all users"
ON public.users
FOR SELECT
USING (public.is_reporting_manager());

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: UPDATE policies (users need to update their own profile)
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can update all users"
ON public.users
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Sync missing profiles from auth.users → public.users
-- Any user who authenticated but has NO row in public.users will be inserted
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.users (
    id,
    user_id,
    email,
    full_name,
    role,
    mobile,
    status,
    created_at
)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'user_id', 'SYNC_' || substr(au.id::text, 1, 8)),
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    COALESCE(au.raw_user_meta_data->>'role', 'teamLeader'),
    au.raw_user_meta_data->>'mobile',
    'active',
    au.created_at
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Run this after the above to confirm everything is fixed
-- ═══════════════════════════════════════════════════════════════════════════
-- Check all users exist:
SELECT id, email, role, status FROM public.users ORDER BY created_at DESC;

-- Check RLS policies on users table:
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public';
