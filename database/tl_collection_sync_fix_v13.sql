-- V13: The IST Timezone Cast Bug & Enhanced Metrics
-- Fixes: Date shifting on month transitions due to naive UTC::DATE casting.
-- Enhancements: Adds accurate Per Day Average and Average Per Rider logic to the backend.

BEGIN;

-- 1. Enhance the daily_collections table structure to safely store derived averages
-- While theoretically calculable on the fly, storing them pre-computed per day ensures fast dashboard loads
ALTER TABLE public.daily_collections ADD COLUMN IF NOT EXISTS runrate NUMERIC DEFAULT 0;

-- 2. Fixed Sync Trigger Function
-- Casts UTC ISO Strings to TIMESTAMPTZ before converting to IST, preventing midnight shifts back to the previous day.
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_tl_id UUID;
    v_date DATE;
    v_active_count INTEGER;
    v_sum NUMERIC;
    v_runrate NUMERIC;
BEGIN
    SELECT team_leader_id INTO v_tl_id 
    FROM public.riders 
    WHERE id = NEW.rider_id;

    IF v_tl_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- CRITICAL TIMEZONE FIX: 
    -- If 'date_on_sheet' is an ISO string (e.g. "2026-02-28T18:30:00Z"), casting it directly to ::DATE yields "2026-02-28".
    -- We MUST cast it to TIMESTAMPTZ first to retain the UTC offset, THEN shift to IST timezone, THEN extract the DATE.
    v_date := COALESCE(
        ((NEW.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE,
        (NEW.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );

    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.riders
    WHERE team_leader_id = v_tl_id AND status = 'active';

    -- Explicit Sum with the same rigorous timezone handling
    SELECT COALESCE(SUM(amount), 0) INTO v_sum
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE r.team_leader_id = v_tl_id
      AND (COALESCE(((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) = v_date)
      AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
      AND wl.mode = 'ADD';

    -- Enhanced Metric: Average Per Rider (Runrate)
    IF v_active_count > 0 THEN
        v_runrate := v_sum / v_active_count;
    ELSE
        v_runrate := 0;
    END IF;

    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, runrate, updated_at)
    VALUES (
        v_tl_id, 
        v_date,
        v_sum,
        v_active_count,
        v_runrate,
        NOW()
    )
    ON CONFLICT (team_leader_id, date) DO UPDATE SET
        total_collection = EXCLUDED.total_collection,
        active_riders_count = EXCLUDED.active_riders_count,
        runrate = EXCLUDED.runrate,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. CLEAN BACKFILL: Repopulate with corrected timezone logic
TRUNCATE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, runrate)
SELECT 
    r.team_leader_id,
    -- THE FIX: Properly cast the JSON string to TIMESTAMPTZ before extracting the IST date
    COALESCE(((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) as v_date,
    SUM(wl.amount) as total,
    COALESCE(tl_counts.active_count, 0) as active_count,
    CASE 
        WHEN COALESCE(tl_counts.active_count, 0) > 0 THEN SUM(wl.amount) / tl_counts.active_count
        ELSE 0 
    END as runrate
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
LEFT JOIN (
    SELECT team_leader_id, COUNT(*) as active_count
    FROM public.riders
    WHERE status = 'active'
    GROUP BY team_leader_id
) tl_counts ON r.team_leader_id = tl_counts.team_leader_id
WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
  AND wl.mode = 'ADD'
  AND r.team_leader_id IS NOT NULL 
GROUP BY r.team_leader_id, v_date, tl_counts.active_count;

COMMIT;
