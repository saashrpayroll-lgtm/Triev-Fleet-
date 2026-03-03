-- ════════════════════════════════════════════════════════════════════════════
-- ULTIMATE COLLECTION CONSISTENCY FIX (V20 - TYPE & TIMEZONE UNIFIED)
-- ════════════════════════════════════════════════════════════════════════════
-- Fixes: Mar 3 vs Mar 2 discrepancy (₹2,386 missing/shifted)
-- Fixes: Missing 'DAILY COLLECTION' (with space) entries.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. UNIFIED TYPE FILTER (Helper to ensure consistent filtering)
-- Includes: DAILY_COLLECTION, DAILY COLLECTION, RENT_COLLECTION, RENT COLLECTION, etc.
CREATE OR REPLACE FUNCTION public.is_collection_txn(p_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        p_type IN (
            'DAILY_COLLECTION', 'DAILY COLLECTION', 
            'RENT_COLLECTION', 'RENT COLLECTION', 
            'FTD_COLLECTION', 'FTD COLLECTION', 
            'COLLECTION', 'RENT'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- 2. UNIFIED DATE RESOLVER (V20 - Forced IST Conversion)
-- Forces all timestamps (transaction_date and created_at) through IST conversion 
-- before extracting the DATE. This prevents 11:58 PM shifting.
CREATE OR REPLACE FUNCTION public.get_ledger_date_v20(p_metadata JSONB, p_transaction_date TIMESTAMPTZ, p_created_at TIMESTAMPTZ)
RETURNS DATE AS $$
BEGIN
    -- Priority:
    -- 1. Explicit transaction_date (Forced to IST)
    -- 2. metadata->date_on_sheet (Already stored as YYYY-MM-DD from import)
    -- 3. created_at (Fallback converted to IST)
    RETURN COALESCE(
        (p_transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, 
        (p_metadata->>'date_on_sheet')::DATE, 
        (p_created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );
EXCEPTION WHEN OTHERS THEN
    RETURN (p_created_at AT TIME ZONE 'Asia/Kolkata')::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- 3. STANDARDIZED RECALCULATION HELPER
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
    AND public.is_collection_txn(wl.transaction_type)
    AND wl.mode = 'ADD'
    AND public.get_ledger_date_v20(wl.metadata, wl.transaction_date::TIMESTAMPTZ, wl.created_at) = p_date;

    -- Historical active count for that date
    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.riders
    WHERE team_leader_id = p_tl_id 
      AND status != 'deleted'
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= p_date
      AND (inactivated_at IS NULL OR (inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > p_date);

    IF v_active_count = 0 THEN v_active_count := 1; END IF;

    -- Upsert
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    VALUES (p_tl_id, p_date, v_total_collection, v_active_count, NOW())
    ON CONFLICT (team_leader_id, date)
    DO UPDATE SET 
        total_collection = EXCLUDED.total_collection,
        active_riders_count = EXCLUDED.active_riders_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. UNIFIED SYNC TRIGGER
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics_final()
RETURNS TRIGGER AS $$
DECLARE
    v_new_tl_id UUID;
    v_old_tl_id UUID;
    v_new_date DATE;
    v_old_date DATE;
BEGIN
    -- Old State (Decrement/Cleanup)
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        IF public.is_collection_txn(OLD.transaction_type) AND OLD.mode = 'ADD' THEN
            SELECT team_leader_id INTO v_old_tl_id FROM public.riders WHERE id = OLD.rider_id;
            v_old_date := public.get_ledger_date_v20(OLD.metadata, OLD.transaction_date::TIMESTAMPTZ, OLD.created_at);

            IF v_old_tl_id IS NOT NULL THEN
                PERFORM public.recalculate_daily_collection_for_date(v_old_tl_id, v_old_date);
            END IF;
        END IF;
    END IF;

    -- New State (Increment/Refresh)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF public.is_collection_txn(NEW.transaction_type) AND NEW.mode = 'ADD' THEN
            SELECT team_leader_id INTO v_new_tl_id FROM public.riders WHERE id = NEW.rider_id;
            v_new_date := public.get_ledger_date_v20(NEW.metadata, NEW.transaction_date::TIMESTAMPTZ, NEW.created_at);

            IF v_new_tl_id IS NOT NULL THEN
                PERFORM public.recalculate_daily_collection_for_date(v_new_tl_id, v_new_date);
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RE-ATTACH TRIGGER
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics_final();


-- 6. FULL DATA RE-SYNC (The Re-Sync we need)
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
        public.get_ledger_date_v20(wl.metadata, wl.transaction_date::TIMESTAMPTZ, wl.created_at) as v_date,
        SUM(wl.amount) as total
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE public.is_collection_txn(wl.transaction_type)
      AND wl.mode = 'ADD'
      AND r.team_leader_id IS NOT NULL 
    GROUP BY r.team_leader_id, v_date
) sub;

COMMIT;
