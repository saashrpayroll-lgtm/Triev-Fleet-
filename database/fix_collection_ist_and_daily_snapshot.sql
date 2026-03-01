-- ════════════════════════════════════════════════════════════════════════════
-- COMPREHENSIVE FIX: Daily Collections Accuracy + IST Timezone + Auto-Reset
-- Run this ENTIRE script in the Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PART 1: FIX TRIGGER — Use IST timezone for date calculation
-- Root cause: trigger was using transaction_date::DATE (UTC) so entries
-- imported after 6:30 PM IST landed on tomorrow's UTC date.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
BEGIN
    -- Determine which row to process (INSERT = NEW, DELETE = OLD)
    DECLARE
        v_row RECORD;
        v_multiplier NUMERIC;
    BEGIN
        IF TG_OP = 'DELETE' THEN
            v_row := OLD;
            v_multiplier := -1; -- Subtract on delete
        ELSE
            v_row := NEW;
            v_multiplier := 1;  -- Add on insert
        END IF;

        -- Get Team Leader ID for this rider
        SELECT team_leader_id INTO v_team_leader_id
        FROM public.riders
        WHERE id = v_row.rider_id;

        IF v_team_leader_id IS NULL THEN
            RETURN NULL;
        END IF;

        -- Only process collection-type ADD credits (not RESET/DAY_OPENING)
        IF v_row.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION')
           AND v_row.mode = 'ADD' THEN
            v_amount := v_row.amount * v_multiplier;
        ELSE
            RETURN NULL;
        END IF;

        -- ★ KEY FIX: Compute date in IST (Asia/Kolkata = UTC+5:30)
        -- Priority: metadata date_on_sheet → transaction_date in IST → created_at in IST
        IF v_row.metadata->>'date_on_sheet' IS NOT NULL THEN
            v_transaction_date := (v_row.metadata->>'date_on_sheet')::DATE;
        ELSIF v_row.transaction_date IS NOT NULL THEN
            v_transaction_date := (v_row.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE;
        ELSE
            v_transaction_date := (v_row.created_at AT TIME ZONE 'Asia/Kolkata')::DATE;
        END IF;

        -- Upsert into daily_collections (add or subtract amount)
        INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
        VALUES (v_team_leader_id, v_transaction_date, v_amount, NOW())
        ON CONFLICT (team_leader_id, date)
        DO UPDATE SET
            total_collection = GREATEST(0, daily_collections.total_collection + EXCLUDED.total_collection),
            updated_at = NOW();
    END;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger and recreate for BOTH INSERT and DELETE
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PART 2: FULL RESYNC — Fix historical data including March 1
-- Rebuilds daily_collections 100% from wallet_ledger using IST dates.
-- This fixes any wrong dates caused by the old UTC-based trigger.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRUNCATE TABLE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
SELECT
    r.team_leader_id,
    -- ★ Use IST date for each transaction
    COALESCE(
        (wl.metadata->>'date_on_sheet')::DATE,
        (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    ) AS txn_date,
    SUM(wl.amount) AS total_collection,
    NOW()
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE
    wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION')
    AND wl.mode = 'ADD'
    AND r.team_leader_id IS NOT NULL
GROUP BY r.team_leader_id, txn_date
ON CONFLICT (team_leader_id, date)
DO UPDATE SET
    total_collection = EXCLUDED.total_collection,
    updated_at = NOW();

COMMIT;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PART 3: CREATE daily_snapshot FUNCTION for 12 AM Auto-Reset
-- This function takes a snapshot of current daily collections at end of day.
-- Call this via pg_cron at 11:59 PM IST (= 18:29 UTC) every night.
-- Or trigger it manually from the Admin panel button.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.snapshot_daily_collections()
RETURNS JSONB AS $$
DECLARE
    v_ist_today DATE;
    v_upserted INTEGER;
BEGIN
    -- Get today's date in IST
    v_ist_today := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    -- Upsert today's aggregated totals into daily_collections
    WITH today_aggregates AS (
        SELECT
            r.team_leader_id,
            SUM(wl.amount) AS total_collection,
            COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) AS active_riders
        FROM public.wallet_ledger wl
        JOIN public.riders r ON wl.rider_id = r.id
        WHERE
            wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION')
            AND wl.mode = 'ADD'
            AND r.team_leader_id IS NOT NULL
            AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE = v_ist_today
        GROUP BY r.team_leader_id
    )
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    SELECT team_leader_id, v_ist_today, total_collection, active_riders, NOW()
    FROM today_aggregates
    ON CONFLICT (team_leader_id, date)
    DO UPDATE SET
        total_collection = EXCLUDED.total_collection,
        active_riders_count = EXCLUDED.active_riders_count,
        updated_at = NOW();

    GET DIAGNOSTICS v_upserted = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'date', v_ist_today,
        'upserted', v_upserted,
        'message', 'Daily snapshot complete for ' || v_ist_today::TEXT
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PART 4: SCHEDULE with pg_cron (Supabase native scheduler)
-- This schedules the snapshot to run at 11:59 PM IST = 18:29 UTC every night.
-- Only run this if pg_cron is enabled in your Supabase project.
-- Go to: Dashboard → Database → Extensions and enable pg_cron first.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Remove any existing schedule with this name first
SELECT cron.unschedule('daily-collection-midnight-snapshot')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-collection-midnight-snapshot'
);

-- Schedule: 18:29 UTC = 11:59 PM IST (just before midnight)
SELECT cron.schedule(
    'daily-collection-midnight-snapshot',
    '29 18 * * *',  -- Every night at 18:29 UTC = 23:59 IST
    $$SELECT public.snapshot_daily_collections();$$
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION QUERIES  (Run separately after the above)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Check March 1 data:
-- SELECT date, SUM(total_collection), COUNT(*) 
-- FROM daily_collections 
-- WHERE date = '2026-03-01'
-- GROUP BY date;

-- Check cron schedule:
-- SELECT * FROM cron.job WHERE jobname = 'daily-collection-midnight-snapshot';
