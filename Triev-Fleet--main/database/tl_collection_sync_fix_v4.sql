-- =========================================================================================
-- ULTIMATE DAILY COLLECTIONS FIX (v4)
-- =========================================================================================
-- Problem: Team Leaders were not seeing collection data on their Performance/Collection pages,
--          and Admin Dashboard metrics weren't matching.
-- Cause: 
-- 1. The trigger `sync_ledger_to_daily_metrics` strictly checked for 'DAILY_COLLECTION'.
-- 2. It ignored 'RENT_COLLECTION' or 'MANUAL_ADJUSTMENT' (if deemed as collection).
-- 3. If a rider didn't have a TL at the EXACT time of adding the wallet_ledger entry, it was lost forever.
--
-- Solution:
-- 1. Broaden the trigger to accept 'DAILY_COLLECTION' and 'RENT_COLLECTION' (both are valid receipts).
-- 2. Handle UPDATE/DELETE gracefully.
-- 3. TRUNCATE and REBUILD the entire `daily_collections` table based on the CURRENT `team_leader_id` of the riders.
-- =========================================================================================

BEGIN;

-- 1. ENHANCED TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
    v_old_date DATE;
    v_old_amount NUMERIC;
    v_old_tl_id UUID;
BEGIN
    -- ==========================================
    -- HANDLE DELETIONS & UPDATES (Decrement)
    -- ==========================================
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        -- Only care about ADDs that are Collections
        IF OLD.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION') AND OLD.mode = 'ADD' THEN
             
             -- Find the TL *at the time* (we use current rider mapping)
             SELECT team_leader_id INTO v_old_tl_id
             FROM public.riders
             WHERE id = OLD.rider_id;

             IF v_old_tl_id IS NOT NULL THEN
                -- Determine Date
                IF OLD.transaction_date IS NOT NULL THEN
                    v_old_date := OLD.transaction_date;
                ELSIF OLD.metadata->>'date_on_sheet' IS NOT NULL THEN
                    v_old_date := (OLD.metadata->>'date_on_sheet')::DATE;
                ELSE
                    v_old_date := OLD.created_at::DATE;
                END IF;

                v_old_amount := OLD.amount;

                -- DECREMENT
                UPDATE public.daily_collections
                SET 
                    total_collection = total_collection - v_old_amount,
                    updated_at = NOW()
                WHERE team_leader_id = v_old_tl_id AND date = v_old_date;
             END IF;
        END IF;
    END IF;

    -- ==========================================
    -- HANDLE INSERTIONS & UPDATES (Increment)
    -- ==========================================
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Only care about ADDs that are Collections
        IF NEW.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION') AND NEW.mode = 'ADD' THEN
            
            -- Get CURRENT TL ID
            SELECT team_leader_id INTO v_team_leader_id
            FROM public.riders
            WHERE id = NEW.rider_id;

            IF v_team_leader_id IS NOT NULL THEN
                -- Determine Date
                IF NEW.transaction_date IS NOT NULL THEN
                    v_transaction_date := NEW.transaction_date;
                ELSIF NEW.metadata->>'date_on_sheet' IS NOT NULL THEN
                    v_transaction_date := (NEW.metadata->>'date_on_sheet')::DATE;
                ELSE
                    v_transaction_date := NEW.created_at::DATE;
                END IF;

                v_amount := NEW.amount;

                -- UPSERT (Increment)
                INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
                VALUES (v_team_leader_id, v_transaction_date, v_amount, NOW())
                ON CONFLICT (team_leader_id, date)
                DO UPDATE SET 
                    total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
                    updated_at = NOW();
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RE-ATTACH TRIGGER
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;

CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();


-- 3. FULL DATA REBUILD (The magic fix for missing historical data)
-- This guarantees that the dashboard metrics precisely match the wallet ledger.
TRUNCATE TABLE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
SELECT 
    r.team_leader_id,
    COALESCE(wl.transaction_date::DATE, (wl.metadata->>'date_on_sheet')::DATE, wl.created_at::DATE) as txn_date,
    SUM(wl.amount) as total_collection,
    NOW()
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE 
    wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION')
    AND wl.mode = 'ADD'
    AND r.team_leader_id IS NOT NULL
GROUP BY r.team_leader_id, txn_date;

COMMIT;
