-- ════════════════════════════════════════════════════════════════════════════
-- MASTER COLLECTION SYNC FIX (V17)
-- ════════════════════════════════════════════════════════════════════════════
-- Fixes the issue where moving a transaction date didn't subtract from the 
-- old date's daily_collections total.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. ROBUST RECALCULATION HELPER
-- This function ensures that any date's total for a TL is re-summed from the source of truth (wallet_ledger)
CREATE OR REPLACE FUNCTION public.recalculate_daily_collection_for_date(p_tl_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_total_collection NUMERIC := 0;
    v_active_count INTEGER := 1;
BEGIN
    -- Recalculate total collection specifically for this TL on this DATE
    SELECT COALESCE(SUM(wl.amount), 0) INTO v_total_collection
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE r.team_leader_id = p_tl_id
    AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
    AND wl.mode = 'ADD'
    AND COALESCE(
        (wl.metadata->>'date_on_sheet')::DATE, 
        wl.transaction_date::DATE, 
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    ) = p_date;

    -- Calculate historical active count for that date
    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.riders
    WHERE team_leader_id = p_tl_id 
      AND status != 'deleted'
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= p_date
      AND (inactivated_at IS NULL OR (inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > p_date);

    IF v_active_count = 0 THEN v_active_count := 1; END IF;

    -- Upsert the corrected value
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    VALUES (p_tl_id, p_date, v_total_collection, v_active_count, NOW())
    ON CONFLICT (team_leader_id, date)
    DO UPDATE SET 
        total_collection = EXCLUDED.total_collection,
        active_riders_count = EXCLUDED.active_riders_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. ENHANCED SYNC TRIGGER
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics_v17()
RETURNS TRIGGER AS $$
DECLARE
    v_new_tl_id UUID;
    v_old_tl_id UUID;
    v_new_date DATE;
    v_old_date DATE;
    v_tz TEXT := 'Asia/Kolkata';
BEGIN
    -- HANDLE DELETIONS & UPDATES (Old State)
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        IF OLD.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION') AND OLD.mode = 'ADD' THEN
            -- Find the TL who was assigned to the rider
            SELECT team_leader_id INTO v_old_tl_id FROM public.riders WHERE id = OLD.rider_id;
            
            v_old_date := COALESCE(
                OLD.transaction_date::DATE, 
                (OLD.metadata->>'date_on_sheet')::DATE, 
                (OLD.created_at AT TIME ZONE v_tz)::DATE
            );

            IF v_old_tl_id IS NOT NULL THEN
                -- Explicitly recalculate Old Date total to ensure accuracy
                PERFORM public.recalculate_daily_collection_for_date(v_old_tl_id, v_old_date);
            END IF;
        END IF;
    END IF;

    -- HANDLE INSERTIONS & UPDATES (New State)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION') AND NEW.mode = 'ADD' THEN
            -- Get Rider's TL
            SELECT team_leader_id INTO v_new_tl_id FROM public.riders WHERE id = NEW.rider_id;

            v_new_date := COALESCE(
                NEW.transaction_date::DATE, 
                (NEW.metadata->>'date_on_sheet')::DATE, 
                (NEW.created_at AT TIME ZONE v_tz)::DATE
            );

            IF v_new_tl_id IS NOT NULL THEN
                -- Explicitly recalculate New Date total
                PERFORM public.recalculate_daily_collection_for_date(v_new_tl_id, v_new_date);
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RE-ATTACH TRIGGER
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics_v17();


-- 4. FULL REBUILD FOR ACCURACY
TRUNCATE TABLE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
SELECT 
    sub.tl_id,
    sub.v_date,
    sub.total,
    GREATEST(
        (
            SELECT COUNT(*)::INTEGER 
            FROM public.riders r2 
            WHERE r2.team_leader_id = sub.tl_id 
            AND r2.status != 'deleted'
            AND (r2.created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= sub.v_date
            AND (r2.inactivated_at IS NULL OR (r2.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > sub.v_date)
        ), 
        1 
    ) as historical_active_count,
    NOW()
FROM (
    SELECT 
        r.team_leader_id as tl_id,
        COALESCE(
            wl.transaction_date::DATE,
            (wl.metadata->>'date_on_sheet')::DATE, 
            (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
        ) as v_date,
        SUM(wl.amount) as total
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
      AND wl.mode = 'ADD'
      AND r.team_leader_id IS NOT NULL 
    GROUP BY r.team_leader_id, v_date
) sub;

COMMIT;
