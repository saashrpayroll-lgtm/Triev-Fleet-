-- =========================================================================================
-- ULTIMATE DAILY COLLECTIONS FIX (v6 - FINAL RECOVERY)
-- =========================================================================================
-- Fixes: 
-- 1. Restores `active_riders_count` logic which was missing in v5.
-- 2. Fixes the "1 Fleet" error across all dashboards and reports.
-- 3. Ensures complete timezone integrity (Asia/Kolkata) for all date calculations.
-- 4. Unified handling of 'DAILY_COLLECTION' and 'RENT_COLLECTION' types.
-- =========================================================================================

BEGIN;

-- 1. ENHANCED TRIGGER FUNCTION WITH TIMEZONE & RIDER COUNT
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
    v_old_date DATE;
    v_old_amount NUMERIC;
    v_old_tl_id UUID;
    v_rider_count INTEGER;
    v_tz TEXT := 'Asia/Kolkata';
BEGIN
    -- ==========================================
    -- HANDLE DELETIONS & UPDATES (Decrement)
    -- ==========================================
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        -- Only care about ADDs that are Collections
        IF OLD.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION') AND OLD.mode = 'ADD' THEN
             SELECT team_leader_id INTO v_old_tl_id FROM public.riders WHERE id = OLD.rider_id;

             IF v_old_tl_id IS NOT NULL THEN
                -- Timezone aware date extraction
                IF OLD.transaction_date IS NOT NULL THEN
                    v_old_date := OLD.transaction_date;
                ELSIF OLD.metadata->>'date_on_sheet' IS NOT NULL THEN
                    v_old_date := timezone(v_tz, (OLD.metadata->>'date_on_sheet')::TIMESTAMPTZ)::DATE;
                ELSE
                    v_old_date := timezone(v_tz, OLD.created_at)::DATE;
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
            SELECT team_leader_id INTO v_team_leader_id FROM public.riders WHERE id = NEW.rider_id;

            IF v_team_leader_id IS NOT NULL THEN
                -- Timezone aware date extraction
                IF NEW.transaction_date IS NOT NULL THEN
                    v_transaction_date := NEW.transaction_date;
                ELSIF NEW.metadata->>'date_on_sheet' IS NOT NULL THEN
                    v_transaction_date := timezone(v_tz, (NEW.metadata->>'date_on_sheet')::TIMESTAMPTZ)::DATE;
                ELSE
                    v_transaction_date := timezone(v_tz, NEW.created_at)::DATE;
                END IF;

                v_amount := NEW.amount;

                -- CALCULATE ACTIVE RIDER COUNT FOR THIS TL ON THIS SPECIFIC DATE
                SELECT COUNT(*)::INTEGER INTO v_rider_count
                FROM public.riders
                WHERE team_leader_id = v_team_leader_id
                AND allotment_date::DATE <= v_transaction_date
                AND (
                    inactivated_at IS NULL 
                    OR inactivated_at::DATE > v_transaction_date
                );

                -- Ensure at least 1 rider if we have a collection
                IF v_rider_count = 0 THEN v_rider_count := 1; END IF;

                -- UPSERT (Increment)
                INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
                VALUES (v_team_leader_id, v_transaction_date, v_amount, v_rider_count, NOW())
                ON CONFLICT (team_leader_id, date)
                DO UPDATE SET 
                    total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
                    active_riders_count = GREATEST(v_rider_count, daily_collections.active_riders_count),
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


-- 3. FULL DATA REBUILD (TIMEZONE & RIDER COUNT AWARE)
TRUNCATE TABLE public.daily_collections;

-- We first rebuild all collections totals
INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
SELECT 
    r.team_leader_id,
    COALESCE(
        wl.transaction_date::DATE, 
        timezone('Asia/Kolkata', (wl.metadata->>'date_on_sheet')::TIMESTAMPTZ)::DATE, 
        timezone('Asia/Kolkata', wl.created_at)::DATE
    ) as txn_date,
    SUM(wl.amount) as total_collection,
    NOW()
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE 
    wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION')
    AND wl.mode = 'ADD'
    AND r.team_leader_id IS NOT NULL
GROUP BY r.team_leader_id, txn_date;

-- Then we backfill the accurate active_riders_count for each day
UPDATE public.daily_collections dc
SET active_riders_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.riders r
    WHERE r.team_leader_id = dc.team_leader_id
    AND r.allotment_date::DATE <= dc.date
    AND (
        r.inactivated_at IS NULL 
        OR r.inactivated_at::DATE > dc.date
    )
);

-- Ensure no zeros/nulls (Fallback to 1)
UPDATE public.daily_collections SET active_riders_count = 1 WHERE active_riders_count = 0 OR active_riders_count IS NULL;

COMMIT;
