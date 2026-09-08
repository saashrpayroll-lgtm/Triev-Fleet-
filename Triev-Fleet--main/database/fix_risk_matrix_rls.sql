-- ════════════════════════════════════════════════════════════════════════════
-- FIX: TL Risk & Wallet Matrix — Data Not Showing in TL / RM / City Ops Panels
--
-- ROOT CAUSE:
--   1. public.riders table has NO SELECT RLS policy → TL/RM/CityOps users
--      get empty data when they call fetchAllRidersPaginated (Supabase returns []).
--
--   2. public.users "Team Leaders can view other Team Leaders" policy only
--      returns rows where role='teamLeader'. This means TL users cannot
--      fetch RM/CityOps rows needed to populate the hierarchy in Risk Matrix.
--
--   3. public.system_settings (used to load global exclusion toggles) has
--      no confirmed SELECT policy for non-admin roles.
--
-- SOLUTION:
--   Allow all authenticated users to SELECT from riders, system_settings,
--   and matrix_daily_snapshots. Expand users SELECT policy so TL/RM/CityOps
--   can load hierarchy data for the Risk Matrix.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FIX: public.riders — Add SELECT policy for ALL authenticated users
--    (Every role needs to read riders to build the Risk Matrix)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to read riders" ON public.riders;
CREATE POLICY "Allow authenticated to read riders"
ON public.riders
FOR SELECT
TO authenticated
USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FIX: public.users — Allow TL/RM/CityOps to read ALL users rows
--    (Needed so Risk Matrix can resolve TL→RM→CityOps hierarchy)
--    We drop the narrow "Team Leaders can view other Team Leaders" policy
--    and replace it with a broader one so TL users can load all users for
--    name resolution in the matrix.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old narrow TL policy
DROP POLICY IF EXISTS "Team Leaders can view other Team Leaders" ON public.users;

-- New: All authenticated users can read all users rows
-- (Users table has no sensitive financial data; all roles need it for hierarchy)
DROP POLICY IF EXISTS "All authenticated users can view all users" ON public.users;
CREATE POLICY "All authenticated users can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- Keep existing admin + self policies in place (they still work with USING(true))
-- Note: Supabase evaluates policies with OR logic — if ANY policy permits, row is visible

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FIX: public.system_settings — Add SELECT policy for all authenticated users
--    (TL/RM/CityOps need to load the global exclusion toggles)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'system_settings'
    ) THEN
        ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

        -- Drop old restrictive policy if exists
        DROP POLICY IF EXISTS "Allow admin read system_settings" ON public.system_settings;
        DROP POLICY IF EXISTS "Allow authenticated read system_settings" ON public.system_settings;

        -- Allow all authenticated users to read system_settings
        CREATE POLICY "Allow authenticated read system_settings"
        ON public.system_settings
        FOR SELECT
        TO authenticated
        USING (true);

        -- Only admins can write system_settings
        DROP POLICY IF EXISTS "Allow admin write system_settings" ON public.system_settings;
        CREATE POLICY "Allow admin write system_settings"
        ON public.system_settings
        FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.users
                WHERE users.id = auth.uid() AND users.role = 'admin'
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.users
                WHERE users.id = auth.uid() AND users.role = 'admin'
            )
        );
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERIFY: matrix_daily_snapshots SELECT policy (should already exist from setup)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'matrix_daily_snapshots'
        AND policyname = 'Allow read matrix_daily_snapshots'
    ) THEN
        CREATE POLICY "Allow read matrix_daily_snapshots"
        ON public.matrix_daily_snapshots
        FOR SELECT TO authenticated
        USING (true);
    END IF;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (Run after applying to confirm)
-- ─────────────────────────────────────────────────────────────────────────────
-- Check riders policies:
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'riders' AND schemaname = 'public'
ORDER BY cmd;

-- Check users policies:
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'users' AND schemaname = 'public'
ORDER BY cmd;

-- Check system_settings policies:
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'system_settings' AND schemaname = 'public'
ORDER BY cmd;

-- Check matrix_daily_snapshots policies:
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'matrix_daily_snapshots' AND schemaname = 'public'
ORDER BY cmd;
