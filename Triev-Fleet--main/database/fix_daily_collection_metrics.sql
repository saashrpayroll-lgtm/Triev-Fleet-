-- FIX DAILY COLLECTION SYNC (INCLUDE RENT)
-- 1. Updates trigger to include RENT_COLLECTION.
-- 2. Fully re-syncs all daily collections from the ledger.

BEGIN;

-- 1. Update the Sync Function
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
BEGIN
    -- Get Team Leader ID for the rider
    SELECT team_leader_id INTO v_team_leader_id
    FROM public.riders
    WHERE id = NEW.rider_id;

    -- If no Team Leader, skip
    IF v_team_leader_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- NEW FILTER: Both 'DAILY_COLLECTION' and 'RENT_COLLECTION' addition counts
    IF NEW.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION') AND NEW.mode = 'ADD' THEN
        v_amount := NEW.amount;
    ELSE
        RETURN NULL; 
    END IF;

    -- Determine Date (Metadata from Sheet or Transaction Date)
    IF NEW.metadata->>'date_on_sheet' IS NOT NULL THEN
        v_transaction_date := (NEW.metadata->>'date_on_sheet')::DATE;
    ELSE
        v_transaction_date := NEW.transaction_date::DATE;
    END IF;

    -- Fallback
    IF v_transaction_date IS NULL THEN
        v_transaction_date := NEW.created_at::DATE;
    END IF;

    -- Upsert into daily_collections
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
    VALUES (v_team_leader_id, v_transaction_date, v_amount, NOW())
    ON CONFLICT (team_leader_id, date)
    DO UPDATE SET 
        total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
        updated_at = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-Attach the Trigger
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();

-- 3. RE-AGGREGATE ALL DATA
-- Clean start to ensure Rent Collections are included
TRUNCATE TABLE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
SELECT 
    r.team_leader_id,
    COALESCE((wl.metadata->>'date_on_sheet')::DATE, wl.transaction_date::DATE, wl.created_at::DATE) as txn_date,
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
