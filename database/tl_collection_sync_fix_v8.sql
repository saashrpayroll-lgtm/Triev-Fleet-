-- =========================================================================================
-- MASTER COLLECTION & METRICS SYNCHRONIZATION FIX (v8)
-- =========================================================================================
-- Fixes the "Shift Backwards" bug where collections between 12 AM and 5:30 AM IST 
-- were recorded as "Yesterday".
--
-- FIXES IN V8:
-- 1. Corrected `created_at` date extraction: Use `AT TIME ZONE 'Asia/Kolkata'` directly.
-- 2. Simplified metadata date parsing.
-- 3. Ensured `FTD_COLLECTION` is consistently included.
-- =========================================================================================

BEGIN;

-- 1. UPDATED TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
    v_active_riders_count INT;
    v_old_date DATE;
    v_old_amount NUMERIC;
    v_old_tl_id UUID;
    v_tz TEXT := 'Asia/Kolkata';
BEGIN
    -- Determine the Transaction Date using Timezone-Aware logic
    -- Priority: Explicit date > Sheet Metadata > Created At (Converted to IST)
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        v_transaction_date := COALESCE(
            NEW.transaction_date::DATE, 
            (NEW.metadata->>'date_on_sheet')::DATE, 
            (NEW.created_at AT TIME ZONE v_tz)::DATE
        );
        v_amount := NEW.amount;
    END IF;

    IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
        v_old_date := COALESCE(
            OLD.transaction_date::DATE, 
            (OLD.metadata->>'date_on_sheet')::DATE, 
            (OLD.created_at AT TIME ZONE v_tz)::DATE
        );
        v_old_amount := OLD.amount;
    END IF;

    -- ==========================================
    -- HANDLE DELETIONS & UPDATES (Decrement)
    -- ==========================================
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        -- Check for all 3 Collection Types
        IF OLD.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION') AND OLD.mode = 'ADD' THEN
             
             -- Find the TL who was assigned to the rider
             SELECT team_leader_id INTO v_old_tl_id
             FROM public.riders
             WHERE id = OLD.rider_id;

             IF v_old_tl_id IS NOT NULL THEN
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
        -- Check for all 3 Collection Types
        IF NEW.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION') AND NEW.mode = 'ADD' THEN
            
            -- Get Rider's TL and Current Fleet Size
            SELECT team_leader_id INTO v_team_leader_id FROM public.riders WHERE id = NEW.rider_id;

            IF v_team_leader_id IS NOT NULL THEN
                -- Calculate active riders for this TL at this moment
                SELECT COUNT(*) INTO v_active_riders_count 
                FROM public.riders 
                WHERE team_leader_id = v_team_leader_id 
                AND status = 'active';

                -- UPSERT (Increment amount, Update rider count)
                INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
                VALUES (v_team_leader_id, v_transaction_date, v_amount, v_active_riders_count, NOW())
                ON CONFLICT (team_leader_id, date)
                DO UPDATE SET 
                    total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
                    active_riders_count = EXCLUDED.active_riders_count, -- Always refresh to latest count
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

-- 3. FULL DATA REBUILD (V8: CORRECT TIMEZONE LOGIC)
TRUNCATE TABLE public.daily_collections;

-- Step A: Insert Collection Totals first
INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
SELECT 
    r.team_leader_id,
    COALESCE(
        wl.transaction_date::DATE, 
        (wl.metadata->>'date_on_sheet')::DATE, 
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    ) as txn_date,
    SUM(wl.amount) as total_collection,
    NOW()
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE 
    wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION')
    AND wl.mode = 'ADD'
    AND r.team_leader_id IS NOT NULL
GROUP BY r.team_leader_id, txn_date;

-- Step B: Update active_riders_count for all records where possible
UPDATE public.daily_collections dc
SET active_riders_count = (
    SELECT COUNT(*) 
    FROM public.riders r 
    WHERE r.team_leader_id = dc.team_leader_id 
    AND r.status = 'active'
);

COMMIT;
