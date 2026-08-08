-- FIX DAILY COLLECTIONS SCRIPT
-- 1. Cleans up legacy triggers that might be polluting daily_collections.
-- 2. Truncates the daily_collections table to remove incorrect data (like manual adjustments).
-- 3. Rebuilds daily_collections STRICTLY from 'DAILY_COLLECTION' ledger entries.
-- 4. Ensures the Sync Trigger is correctly applied for future updates.

BEGIN;

-- 1. DROP LEGACY TRIGGERS (Safety Step)
-- If the old 'wallet_transactions' table is still receiving data, we don't want it to update daily_collections.
DROP TRIGGER IF EXISTS on_wallet_transaction_insert ON public.wallet_transactions;
DROP FUNCTION IF EXISTS public.handle_new_wallet_transaction();

-- 2. TRUNCATE daily_collections
-- Remove all existing aggregated data to start fresh.
TRUNCATE TABLE public.daily_collections;

-- 3. REBUILD from wallet_ledger
-- STRICT FILTER: Only 'DAILY_COLLECTION' type and 'ADD' mode.
-- This ensures Manual Adjustments, Rent Deductions, etc., are EXCLUDED.
INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
SELECT 
    r.team_leader_id,
    COALESCE((wl.metadata->>'date_on_sheet')::DATE, wl.transaction_date, wl.created_at::DATE) as txn_date,
    SUM(wl.amount) as total_collection,
    NOW()
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE 
    wl.transaction_type = 'DAILY_COLLECTION' -- <--- CRITICAL FILTER
    AND wl.mode = 'ADD'
    AND r.team_leader_id IS NOT NULL
GROUP BY r.team_leader_id, txn_date;

-- 4. ENSURE SYNC TRIGGER IS CORRECT
-- (Re-applying the correct trigger logic just in case it was modified)
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
BEGIN
    -- 1. Get Team Leader ID
    SELECT team_leader_id INTO v_team_leader_id
    FROM public.riders
    WHERE id = NEW.rider_id;

    IF v_team_leader_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 2. STRICT FILTER: Only 'DAILY_COLLECTION' counts.
    IF NEW.transaction_type = 'DAILY_COLLECTION' AND NEW.mode = 'ADD' THEN
        v_amount := NEW.amount;
    ELSE
        RETURN NULL; -- Ignore all other types
    END IF;

    -- 3. Determine Date
    IF NEW.metadata->>'date_on_sheet' IS NOT NULL THEN
        v_transaction_date := (NEW.metadata->>'date_on_sheet')::DATE;
    ELSE
        v_transaction_date := NEW.transaction_date; -- Use specific transaction date if set
    END IF;
    
    -- Fallback if transaction_date is null (shouldn't happen with new logic)
    IF v_transaction_date IS NULL THEN
         v_transaction_date := NEW.created_at::DATE;
    END IF;

    -- 4. Upsert
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
    VALUES (v_team_leader_id, v_transaction_date, v_amount, NOW())
    ON CONFLICT (team_leader_id, date)
    DO UPDATE SET 
        total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
        updated_at = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Trigger
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();

COMMIT;

-- VERIFICATION
SELECT count(*) as total_records_restored FROM public.daily_collections;
