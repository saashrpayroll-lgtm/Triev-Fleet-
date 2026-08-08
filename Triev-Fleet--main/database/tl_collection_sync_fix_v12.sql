-- V12: Final Metrics Integrity & Table Parity Fix
-- Fixes: Foreign Key Mismatch, Row-Limit Resiliency, and 0-Active-Rider TLs

BEGIN;

-- 1. Fix Foreign Key Constraint
-- The previous constraint might have been pointing to auth.users or was missing the public schema reference.
-- We ensure it points to public.users where our TL profiles are stored.
ALTER TABLE public.daily_collections DROP CONSTRAINT IF EXISTS daily_collections_team_leader_id_fkey;

ALTER TABLE public.daily_collections 
    ADD CONSTRAINT daily_collections_team_leader_id_fkey 
    FOREIGN KEY (team_leader_id) 
    REFERENCES public.users(id) 
    ON DELETE CASCADE;

-- 2. Optimized Sync Trigger Function
-- Resilience against NULL TLs and optimized for 0-active-rider cases.
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

    -- Skip if no TL assigned (cannot aggregate to a TL dashboard)
    IF v_tl_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get normalized transaction date in IST
    v_date := COALESCE(
        (NEW.metadata->>'date_on_sheet')::DATE,
        (NEW.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );

    -- Calculate current active riders for this TL
    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.riders
    WHERE team_leader_id = v_tl_id AND status = 'active';

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

-- 3. Update Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_daily_collections_date_tl ON public.daily_collections(date, team_leader_id);

-- 4. CLEAN BACKFILL: Ensuring every transaction is captured
TRUNCATE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count)
SELECT 
    r.team_leader_id,
    COALESCE((wl.metadata->>'date_on_sheet')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) as v_date,
    SUM(wl.amount) as total,
    COALESCE(tl_counts.active_count, 0) -- Use 0 if TL has no active riders
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
LEFT JOIN (
    -- Pre-calculate active counts to avoid subquery in main group
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
