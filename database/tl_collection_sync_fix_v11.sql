-- V11: Robust Collection & Fleet Force Aggregation
-- Fixes: NULL Team Leader Handling, Duplicate Prevention, and Accurate Active Count

BEGIN;

-- 1. Ensure the table has the correct structure (Idempotent)
ALTER TABLE public.daily_collections ADD COLUMN IF NOT EXISTS active_riders_count INTEGER DEFAULT 0;

-- 2. Refined Sync Trigger Function
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_tl_id UUID;
    v_date DATE;
    v_active_count INTEGER;
BEGIN
    -- Get TL ID (Prioritize rider's current TL if ledger doesn't have it)
    SELECT team_leader_id INTO v_tl_id 
    FROM public.riders 
    WHERE id = NEW.rider_id;

    -- CRITICAL: Skip if no TL assigned. We cannot aggregate without a TL.
    IF v_tl_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get normalized transaction date in IST
    v_date := COALESCE(
        (NEW.metadata->>'date_on_sheet')::DATE,
        (NEW.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );

    -- Calculate current active riders for this TL for Fleet Force accuracy
    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.riders
    WHERE team_leader_id = v_tl_id AND status = 'active';

    -- Upsert daily metrics
    -- We use a subquery for the sum to ensure we don't double count or miss types
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    VALUES (
        v_tl_id, 
        v_date,
        (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.wallet_ledger wl
            JOIN public.riders r ON wl.rider_id = r.id
            WHERE r.team_leader_id = v_tl_id
              AND (COALESCE((wl.metadata->>'date_on_sheet')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) = v_date)
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

-- 3. Re-attach trigger
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();

-- 4. CLEAN BACKFILL: Wipe and Rebuild (The only way to ensure 100% accuracy)
TRUNCATE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count)
SELECT 
    r.team_leader_id,
    COALESCE((wl.metadata->>'date_on_sheet')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) as v_date,
    SUM(wl.amount) as total,
    MIN(tl_counts.active_count)
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
JOIN (
    -- Pre-calculate current active counts to avoid subquery in main group
    SELECT team_leader_id, COUNT(*) as active_count
    FROM public.riders
    WHERE status = 'active'
    GROUP BY team_leader_id
) tl_counts ON r.team_leader_id = tl_counts.team_leader_id
WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
  AND wl.mode = 'ADD'
  AND r.team_leader_id IS NOT NULL -- CRITICAL FIX: Skip transactions with no TL
GROUP BY r.team_leader_id, v_date;

COMMIT;
