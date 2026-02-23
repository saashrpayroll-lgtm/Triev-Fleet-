-- FIX COLLECTION DELETION SYNC SCRIPT
-- 1. Upgrades the sync trigger to handle DELETE and UPDATE operations.
-- 2. Ensures TL Performance metrics decrease when a wrong collection is deleted.
-- 3. Performs a final reconciliation to fix any past stale data.

BEGIN;

-- 1. Upgrade the Sync Function to handle all operations
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_tl_id_old UUID;
    v_tl_id_new UUID;
    v_date_old DATE;
    v_date_new DATE;
BEGIN
    -- A. Handle DELETE or UPDATE (Subtract Old Values)
    -- This ensures that if a record is deleted or changed, the old bucket is cleared.
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        IF OLD.transaction_type = 'DAILY_COLLECTION' AND OLD.mode = 'ADD' THEN
            -- Find TL at the time of the old transaction
            SELECT team_leader_id INTO v_tl_id_old FROM public.riders WHERE id = OLD.rider_id;
            
            IF v_tl_id_old IS NOT NULL THEN
                v_date_old := COALESCE((OLD.metadata->>'date_on_sheet')::DATE, OLD.transaction_date::DATE, OLD.created_at::DATE);
                
                UPDATE public.daily_collections 
                SET total_collection = total_collection - OLD.amount,
                    updated_at = NOW()
                WHERE team_leader_id = v_tl_id_old AND date = v_date_old;
            END IF;
        END IF;
    END IF;

    -- B. Handle INSERT or UPDATE (Add New Values)
    -- This ensures that if a record is added or changed, the new bucket is updated.
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.transaction_type = 'DAILY_COLLECTION' AND NEW.mode = 'ADD' THEN
            -- Find current TL for the rider
            SELECT team_leader_id INTO v_tl_id_new FROM public.riders WHERE id = NEW.rider_id;
            
            IF v_tl_id_new IS NOT NULL THEN
                v_date_new := COALESCE((NEW.metadata->>'date_on_sheet')::DATE, NEW.transaction_date::DATE, NEW.created_at::DATE);
                
                INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
                VALUES (v_tl_id_new, v_date_new, NEW.amount, NOW())
                ON CONFLICT (team_leader_id, date)
                DO UPDATE SET 
                    total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
                    updated_at = NOW();
            END IF;
        END IF;
    END IF;

    -- Return appropriately
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Upgrade the Trigger to fire on ALL operations
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();

-- 3. FINAL RECONCILIATION (One-time Cleanup)
-- This ensures the daily_collections table is perfectly synced with the ledger.
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
    wl.transaction_type = 'DAILY_COLLECTION'
    AND wl.mode = 'ADD'
    AND r.team_leader_id IS NOT NULL
GROUP BY r.team_leader_id, txn_date;

COMMIT;

-- Verification
SELECT count(*) as "Total Corrected collection records" FROM public.daily_collections;
