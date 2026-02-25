-- =========================================================================================
-- ULTIMATE DAILY COLLECTIONS FIX (v5 - TIMEZONE AWARE)
-- =========================================================================================
-- Problem: Collections deposited after 12:00 AM IST but before 5:30 AM IST were being logged 
--          as "Yesterday" on the dashboards because Postgres processes `created_at::DATE` 
--          using UTC time by default.
-- Cause: "2026-02-24T20:24:19.709Z" (UTC) is actually 2026-02-25 01:54 AM (IST).
--         When cast directly to DATE in Postgres, it became 2026-02-24, hiding it from "Today".
--
-- Solution: Force timeline conversion to `Asia/Kolkata` before extracting the DATE.
-- =========================================================================================

BEGIN;

-- 1. ENHANCED TRIGGER FUNCTION WITH TIMEZONE FIX
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
    v_old_date DATE;
    v_old_amount NUMERIC;
    v_old_tl_id UUID;
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

                -- UPSERT (Increment)
                INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
                VALUES (v_team_leader_id, v_transaction_date, v_amount, NOW())
                ON CONFLICT (team_leader_id, date)
                DO UPDATE SET 
                    total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
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


-- 3. FULL DATA REBUILD (TIMEZONE AWARE)
-- This rebuilds the daily_collections using the accurate localized date
TRUNCATE TABLE public.daily_collections;

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

COMMIT;
