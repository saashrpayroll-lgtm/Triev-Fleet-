-- V16: Historical Fleet Count Resolution
-- Fixes the bug where updating past collections (or running backfills) overwrote historical daily active_riders_count with the *current* real-time active rider count.

BEGIN;

-- 1. Optimized Sync Trigger Function
-- Instead of getting the live current `active` count, we mathematically reconstruct the historical active fleet for the specific transaction `v_date`.
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_tl_id UUID;
    v_date DATE;
    v_active_count INTEGER;
BEGIN
    -- Get TL ID from the riders table for the transaction
    SELECT team_leader_id INTO v_tl_id 
    FROM public.riders 
    WHERE id = NEW.rider_id;

    -- Skip if no TL assigned
    IF v_tl_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get normalized transaction date in IST
    v_date := COALESCE(
        ((NEW.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE,
        (NEW.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );

    -- Calculate historical active riders for this TL specifically on v_date
    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.riders
    WHERE team_leader_id = v_tl_id 
      AND status != 'deleted'
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= v_date
      AND (inactivated_at IS NULL OR (inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > v_date);

    -- Fallback safety measure if math yields 0 but collections exist (e.g. legacy migrated riders missing created_at properly)
    IF v_active_count = 0 THEN
        v_active_count := 1;
    END IF;

    -- Upsert daily metrics with explicit sum to ensure accuracy
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    VALUES (
        v_tl_id, 
        v_date,
        (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.wallet_ledger wl
            JOIN public.riders r ON wl.rider_id = r.id
            WHERE r.team_leader_id = v_tl_id
              AND (COALESCE(((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) = v_date)
              AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
              AND wl.mode = 'ADD'
        ),
        v_active_count,
        NOW()
    )
    ON CONFLICT (team_leader_id, date) DO UPDATE SET
        total_collection = EXCLUDED.total_collection,
        active_riders_count = EXCLUDED.active_riders_count,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RE-RUN FULL BACKFILL WITH HISTORICAL CALCULATIONS
-- We truncate to clear the bad data (where current fleet count overwrote past dates)
TRUNCATE public.daily_collections;

-- Backfill dynamically calculating historical fleet count using subquery
INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count)
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
        1 -- Safe fallback so we don't divide by 0 in frontend Avg
    ) as historical_active_count
FROM (
    SELECT 
        r.team_leader_id as tl_id,
        COALESCE(((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) as v_date,
        SUM(wl.amount) as total
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
      AND wl.mode = 'ADD'
      AND r.team_leader_id IS NOT NULL 
    GROUP BY r.team_leader_id, v_date
) sub;

COMMIT;
