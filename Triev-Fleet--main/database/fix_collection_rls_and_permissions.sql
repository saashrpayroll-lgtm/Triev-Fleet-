-- ═══════════════════════════════════════════════════════════════════════════════
-- CRITICAL FIX: Collection RLS Policies & Full Data Visibility
-- 
-- PROBLEM: Row Level Security (RLS) on `daily_collections` and `wallet_ledger`
-- was blocking SELECT queries for Admin, TL, CityOps, and RM roles, returning
-- 0 rows (empty array) across all dashboard panels, cards, and reports.
--
-- Run this ENTIRE script in the Supabase SQL Editor once.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FIX RLS ON public.daily_collections
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.daily_collections ENABLE ROW LEVEL SECURITY;

-- Drop all old/restrictive policies
DROP POLICY IF EXISTS "Allow authenticated users to read daily_collections" ON public.daily_collections;
DROP POLICY IF EXISTS "Admins can do everything on daily_collections" ON public.daily_collections;
DROP POLICY IF EXISTS "Team Leaders can view their own collections" ON public.daily_collections;
DROP POLICY IF EXISTS "Team Leaders can view all collections" ON public.daily_collections;
DROP POLICY IF EXISTS "Reporting Managers can view daily collections" ON public.daily_collections;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.daily_collections;
DROP POLICY IF EXISTS "daily_collections_select_policy" ON public.daily_collections;

-- Allow all authenticated and anon users to read daily collections
CREATE POLICY "Allow authenticated users to read daily_collections"
ON public.daily_collections
FOR SELECT
TO authenticated, anon
USING (true);

-- Allow write access for background syncs / RPCs
DROP POLICY IF EXISTS "Allow authenticated to write daily_collections" ON public.daily_collections;
CREATE POLICY "Allow authenticated to write daily_collections"
ON public.daily_collections
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FIX RLS ON public.wallet_ledger
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

-- Drop restrictive policies
DROP POLICY IF EXISTS "Allow authenticated users to read wallet_ledger" ON public.wallet_ledger;
DROP POLICY IF EXISTS "Reporting Managers can view wallet ledger" ON public.wallet_ledger;
DROP POLICY IF EXISTS "Team Leaders can view their riders' transactions" ON public.wallet_ledger;
DROP POLICY IF EXISTS "Admins can view all wallet ledger" ON public.wallet_ledger;
DROP POLICY IF EXISTS "wallet_ledger_select_policy" ON public.wallet_ledger;

-- Allow all authenticated and anon users to read wallet_ledger
CREATE POLICY "Allow authenticated users to read wallet_ledger"
ON public.wallet_ledger
FOR SELECT
TO authenticated, anon
USING (true);

-- Allow insert/update for ledger operations
DROP POLICY IF EXISTS "Allow authenticated to insert wallet_ledger" ON public.wallet_ledger;
CREATE POLICY "Allow authenticated to insert wallet_ledger"
ON public.wallet_ledger
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to update wallet_ledger" ON public.wallet_ledger;
CREATE POLICY "Allow authenticated to update wallet_ledger"
ON public.wallet_ledger
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FIX RLS ON public.riders
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read riders" ON public.riders;
DROP POLICY IF EXISTS "Reporting Managers can view all riders" ON public.riders;

CREATE POLICY "Allow authenticated users to read riders"
ON public.riders
FOR SELECT
TO authenticated, anon
USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FIX RLS ON public.wallet_snapshots
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_snapshots') THEN
        ALTER TABLE public.wallet_snapshots ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow authenticated to read wallet_snapshots" ON public.wallet_snapshots;
        CREATE POLICY "Allow authenticated to read wallet_snapshots"
        ON public.wallet_snapshots
        FOR SELECT
        TO authenticated, anon
        USING (true);
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RUN FULL RESYNC TO REBUILD ALL COLLECTIONS
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.resync_all_daily_collections();

COMMIT;
