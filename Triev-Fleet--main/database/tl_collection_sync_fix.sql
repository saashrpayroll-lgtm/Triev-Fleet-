-- FIX: DYNAMIC TEAM LEADER DAILY COLLECTION MIGRATION
-- This script ensures that when a Rider changes Team Leaders, their past collection
-- history (FTD/Weekly/Total) automatically transfers from the OLD TL to the NEW TL.

BEGIN;

-- 1. Create a function to totally recalculate a single TL's collections based on CURRENT riders
CREATE OR REPLACE FUNCTION public.recalculate_tl_daily_collections(p_tl_id UUID)
RETURNS VOID AS $$
BEGIN
    IF p_tl_id IS NULL THEN 
        RETURN; 
    END IF;

    -- A. Delete existing aggregated data for this specific Team Leader
    DELETE FROM public.daily_collections WHERE team_leader_id = p_tl_id;

    -- B. Re-aggregate data strictly from riders CURRENTLY assigned to this Team Leader
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
    SELECT 
        r.team_leader_id,
        COALESCE((wl.metadata->>'date_on_sheet')::DATE, wl.transaction_date::DATE, wl.created_at::DATE) as txn_date,
        SUM(wl.amount) as total_collection,
        NOW()
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE 
        r.team_leader_id = p_tl_id
        AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION')
        AND wl.mode = 'ADD'
    GROUP BY r.team_leader_id, txn_date;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Create the Trigger Function that runs when a Rider's TL changes
CREATE OR REPLACE FUNCTION public.trg_fn_rider_tl_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the team_leader_id actually changed
    IF OLD.team_leader_id IS DISTINCT FROM NEW.team_leader_id THEN
        
        -- Recalculate collections for the OLD Team Leader (Subtracts the rider's history)
        IF OLD.team_leader_id IS NOT NULL THEN
            PERFORM public.recalculate_tl_daily_collections(OLD.team_leader_id);
        END IF;

        -- Recalculate collections for the NEW Team Leader (Adds the rider's history)
        IF NEW.team_leader_id IS NOT NULL THEN
            PERFORM public.recalculate_tl_daily_collections(NEW.team_leader_id);
        END IF;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Attach the Trigger to the riders table
DROP TRIGGER IF EXISTS trg_rider_tl_change ON public.riders;
CREATE TRIGGER trg_rider_tl_change
    AFTER UPDATE OF team_leader_id ON public.riders
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_rider_tl_change();


-- 4. ONE-TIME FIX FOR EXISTING NEW TLs (Mosin, Sanju Singh, etc.)
-- We will instantly rebuild the ENTIRE daily_collections table based on the CURRENT mapping.
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
