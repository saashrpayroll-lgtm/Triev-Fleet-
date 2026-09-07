-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: Permanent Deletion of Riders & RLS DELETE Permissions
-- 
-- PROBLEM: Deleting riders from Trash section failed because:
-- 1. `wallet_ledger` and `riders` tables had RLS policies blocking DELETE queries.
-- 2. Foreign key references in child tables prevented direct deletion.
-- 
-- SOLUTION:
-- 1. Grant full DELETE permissions for authenticated users on relevant tables.
-- 2. Provide robust `permanent_delete_rider()` and `bulk_permanent_delete_riders()` RPCs.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. FIX RLS DELETE POLICIES ON RIDERS & RELATED TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- A. public.riders
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated to delete riders" ON public.riders;
CREATE POLICY "Allow authenticated to delete riders"
ON public.riders
FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated to update riders" ON public.riders;
CREATE POLICY "Allow authenticated to update riders"
ON public.riders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to insert riders" ON public.riders;
CREATE POLICY "Allow authenticated to insert riders"
ON public.riders
FOR INSERT
TO authenticated
WITH CHECK (true);

-- B. public.wallet_ledger
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated to delete wallet_ledger" ON public.wallet_ledger;
CREATE POLICY "Allow authenticated to delete wallet_ledger"
ON public.wallet_ledger
FOR DELETE
TO authenticated
USING (true);

-- C. public.wallet_transactions (Legacy)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
        ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow authenticated to delete wallet_transactions" ON public.wallet_transactions;
        CREATE POLICY "Allow authenticated to delete wallet_transactions"
        ON public.wallet_transactions
        FOR DELETE
        TO authenticated
        USING (true);
    END IF;
END $$;

-- D. public.requests
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'requests') THEN
        ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow authenticated to delete requests" ON public.requests;
        CREATE POLICY "Allow authenticated to delete requests"
        ON public.requests
        FOR DELETE
        TO authenticated
        USING (true);
    END IF;
END $$;

-- E. public.wallet_snapshots
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_snapshots') THEN
        ALTER TABLE public.wallet_snapshots ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow authenticated to delete wallet_snapshots" ON public.wallet_snapshots;
        CREATE POLICY "Allow authenticated to delete wallet_snapshots"
        ON public.wallet_snapshots
        FOR DELETE
        TO authenticated
        USING (true);
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BULLETPROOF PERMANENT DELETE RPCS
-- ─────────────────────────────────────────────────────────────────────────────

-- Single Rider Permanent Delete RPC
CREATE OR REPLACE FUNCTION public.permanent_delete_rider(p_rider_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rider_name TEXT;
    v_triev_id TEXT;
BEGIN
    -- 1. Check if rider exists and get info
    SELECT rider_name, triev_id INTO v_rider_name, v_triev_id
    FROM public.riders
    WHERE id = p_rider_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Rider not found.');
    END IF;

    -- 2. Cascade delete all dependent data cleanly
    DELETE FROM public.wallet_ledger WHERE rider_id = p_rider_id;
    
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
        DELETE FROM public.wallet_transactions WHERE rider_id = p_rider_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'requests') THEN
        DELETE FROM public.requests WHERE related_entity_id = p_rider_id::TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_snapshots') THEN
        DELETE FROM public.wallet_snapshots WHERE rider_id = p_rider_id;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'battery_swaps') THEN
        DELETE FROM public.battery_swaps WHERE rider_id = p_rider_id;
    END IF;

    -- 3. Delete the rider record
    DELETE FROM public.riders WHERE id = p_rider_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Rider ' || COALESCE(v_rider_name, '') || ' (' || COALESCE(v_triev_id, '') || ') permanently deleted.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- Bulk Riders Permanent Delete RPC
CREATE OR REPLACE FUNCTION public.bulk_permanent_delete_riders(p_rider_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
BEGIN
    IF p_rider_ids IS NULL OR array_length(p_rider_ids, 1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No rider IDs provided.');
    END IF;

    -- 1. Delete dependent data
    DELETE FROM public.wallet_ledger WHERE rider_id = ANY(p_rider_ids);

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN
        DELETE FROM public.wallet_transactions WHERE rider_id = ANY(p_rider_ids);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'requests') THEN
        DELETE FROM public.requests WHERE related_entity_id = ANY(SELECT unnest(p_rider_ids)::TEXT);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_snapshots') THEN
        DELETE FROM public.wallet_snapshots WHERE rider_id = ANY(p_rider_ids);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'battery_swaps') THEN
        DELETE FROM public.battery_swaps WHERE rider_id = ANY(p_rider_ids);
    END IF;

    -- 2. Delete riders
    DELETE FROM public.riders WHERE id = ANY(p_rider_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'message', v_deleted_count || ' riders permanently deleted successfully.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.permanent_delete_rider(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.bulk_permanent_delete_riders(UUID[]) TO authenticated, anon;

COMMIT;
