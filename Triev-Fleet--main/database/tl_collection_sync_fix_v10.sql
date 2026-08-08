-- TL COLLECTION SYNC FIX V10 (Fleet Force & Transaction Types Fix)
-- 1. Adds active_riders_count to daily_collections.
-- 2. Updates trigger to maintain active rider counts.
-- 3. Includes 'COLLECTION' transaction type in all aggregations.

BEGIN;

-- 1. ADD COLUMN TO daily_collections
ALTER TABLE public.daily_collections 
ADD COLUMN IF NOT EXISTS active_riders_count INTEGER DEFAULT 0;

-- 2. UPDATED TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_date DATE;
    v_tl_id UUID;
    v_active_count INTEGER;
BEGIN
    -- Only process relevant transaction types
    -- V10: Ensure 'COLLECTION' is included
    IF NEW.transaction_type NOT IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION') 
       OR NEW.mode != 'ADD' THEN
        RETURN NEW;
    END IF;

    -- Extract correct IST Date
    v_date := COALESCE(
        (NEW.metadata->>'date_on_sheet')::DATE,
        (NEW.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );

    -- Get Team Leader ID from Riders table
    SELECT team_leader_id INTO v_tl_id FROM public.riders WHERE id = NEW.rider_id;

    IF v_tl_id IS NOT NULL AND v_date IS NOT NULL THEN
        -- Get current active rider count for this TL
        SELECT COUNT(*) INTO v_active_count 
        FROM public.riders 
        WHERE team_leader_id = v_tl_id 
        AND status = 'active';

        -- UPSERT into daily_collections
        INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
        VALUES (v_tl_id, v_date, NEW.amount, v_active_count, NOW())
        ON CONFLICT (team_leader_id, date)
        DO UPDATE SET 
            total_collection = (
                SELECT SUM(amount) 
                FROM public.wallet_ledger wl
                JOIN public.riders r ON wl.rider_id = r.id
                WHERE r.team_leader_id = EXCLUDED.team_leader_id
                  AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
                  AND wl.mode = 'ADD'
                  AND COALESCE((wl.metadata->>'date_on_sheet')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) = EXCLUDED.date
            ),
            active_riders_count = EXCLUDED.active_riders_count,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RE-ATTACH TRIGGER
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();

-- 4. FULL DATA REBUILD (Backfill with active_riders_count)
TRUNCATE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
SELECT 
    r.team_leader_id,
    COALESCE(
        (wl.metadata->>'date_on_sheet')::DATE,
        (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    ) as txn_date,
    SUM(wl.amount) as total,
    (
        SELECT COUNT(*) 
        FROM public.riders r2 
        WHERE r2.team_leader_id = r.team_leader_id 
        AND r2.status = 'active'
    ) as active_count,
    NOW()
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
  AND wl.mode = 'ADD'
  AND r.team_leader_id IS NOT NULL
GROUP BY r.team_leader_id, txn_date
ON CONFLICT (team_leader_id, date) DO UPDATE SET 
    total_collection = EXCLUDED.total_collection,
    active_riders_count = EXCLUDED.active_riders_count,
    updated_at = NOW();

COMMIT;
