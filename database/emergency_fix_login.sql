-- ============================================================================
-- EMERGENCY FIX: Restore Login for ALL users (Admin, TL, RM)
-- ============================================================================
-- PROBLEM: fix_rm_rls.sql created a policy on public.users that uses a 
-- direct query to public.users (causing RLS infinite recursion).
-- This blocks ALL users from reading their own profile → "Profile Not Found"
--
-- SOLUTION: Drop ALL broken policies, re-create using SECURITY DEFINER functions
-- ============================================================================

-- STEP 1: Create/Replace SECURITY DEFINER helper functions (bypass RLS safely)
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

-- STEP 2: Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- STEP 3: Drop ALL existing SELECT policies on users table (clean slate)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Team Leaders can view other Team Leaders" ON public.users;
DROP POLICY IF EXISTS "Reporting Managers can view all users" ON public.users;

-- STEP 4: Re-create ALL SELECT policies correctly
-- 4a. CRITICAL: Every user MUST read their own row
CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- 4b. Admins can view ALL users
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (public.is_admin());

-- 4c. Team Leaders can view other Team Leaders (for leaderboard)
CREATE POLICY "Team Leaders can view other Team Leaders"
ON public.users
FOR SELECT
USING (
  public.is_team_leader()
  AND role = 'teamLeader'
);

-- 4d. Reporting Managers can view all users (for RM panel)
CREATE POLICY "Reporting Managers can view all users"
ON public.users
FOR SELECT
USING (public.is_reporting_manager());

-- STEP 5: Ensure UPDATE policies exist
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

-- STEP 6: Fix RM policies on OTHER tables (using SECURITY DEFINER function)
DROP POLICY IF EXISTS "Reporting Managers can view all riders" ON public.riders;
CREATE POLICY "Reporting Managers can view all riders"
ON public.riders
FOR SELECT
USING (public.is_reporting_manager());

DROP POLICY IF EXISTS "Reporting Managers can view all leads" ON public.leads;
CREATE POLICY "Reporting Managers can view all leads"
ON public.leads
FOR SELECT
USING (public.is_reporting_manager());

DROP POLICY IF EXISTS "Reporting Managers can view daily collections" ON public.daily_collections;
CREATE POLICY "Reporting Managers can view daily collections"
ON public.daily_collections
FOR SELECT
USING (public.is_reporting_manager());

DROP POLICY IF EXISTS "Reporting Managers can view wallet ledger" ON public.wallet_ledger;
CREATE POLICY "Reporting Managers can view wallet ledger"
ON public.wallet_ledger
FOR SELECT
USING (public.is_reporting_manager());

DROP POLICY IF EXISTS "Reporting Managers can view wallet snapshots" ON public.wallet_snapshots;
CREATE POLICY "Reporting Managers can view wallet snapshots"
ON public.wallet_snapshots
FOR SELECT
USING (public.is_reporting_manager());

-- VERIFICATION: Check policies are correctly applied
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public';
