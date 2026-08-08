-- ════════════════════════════════════════════════════════════════════════════
-- EMERGENCY FIX: Recalculate daily_collections + Fix trigger date parsing
-- Run this in Supabase SQL Editor RIGHT NOW to fix Aftab's ₹933 → ₹1,533
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 1: Fix the safe_date helper — handles both DATE strings AND full ISO
--         timestamp strings (e.g., '2026-03-04T12:00:00+05:30')
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.extract_ist_date(v_text TEXT)
RETURNS DATE AS $$
BEGIN
    IF v_text IS NULL THEN RETURN NULL; END IF;
    -- Try as TIMESTAMPTZ first (handles full ISO strings like '2026-03-04T12:00:00+05:30')
    BEGIN
        RETURN (v_text::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    -- Fallback: try plain DATE string
    BEGIN
        RETURN v_text::DATE;
    EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 2: Rebuild the recalculation helper using the safe date extractor
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_daily_collection_for_date(p_tl_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_total_collection NUMERIC := 0;
    v_active_count INTEGER := 1;
BEGIN
    SELECT COALESCE(SUM(wl.amount), 0) INTO v_total_collection
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE r.team_leader_id = p_tl_id
      AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION')
      AND wl.mode = 'ADD'
      AND COALESCE(
            -- ✅ Safe: handles full ISO timestamp strings (e.g., '2026-03-04T12:00:00+05:30')
            public.extract_ist_date(wl.metadata->>'date_on_sheet'),
            -- Then try the native transaction_date column
            (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
            -- Final fallback: created_at in IST
            (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
        ) = p_date;

    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.riders
    WHERE team_leader_id = p_tl_id 
      AND status != 'deleted'
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= p_date
      AND (inactivated_at IS NULL OR (inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > p_date);

    IF v_active_count = 0 THEN v_active_count := 1; END IF;

    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    VALUES (p_tl_id, p_date, v_total_collection, v_active_count, NOW())
    ON CONFLICT (team_leader_id, date)
    DO UPDATE SET 
        total_collection = EXCLUDED.total_collection,
        active_riders_count = EXCLUDED.active_riders_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 3: Rebuild the sync trigger with the fixed date parsing
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics_v17()
RETURNS TRIGGER AS $$
DECLARE
    v_new_tl_id UUID;
    v_old_tl_id UUID;
    v_new_date DATE;
    v_old_date DATE;
BEGIN
    -- HANDLE DELETIONS & UPDATES (Old State)
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        IF OLD.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION') AND OLD.mode = 'ADD' THEN
            SELECT team_leader_id INTO v_old_tl_id FROM public.riders WHERE id = OLD.rider_id;
            v_old_date := COALESCE(
                public.extract_ist_date(OLD.metadata->>'date_on_sheet'),
                (OLD.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
                (OLD.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
            );
            IF v_old_tl_id IS NOT NULL THEN
                PERFORM public.recalculate_daily_collection_for_date(v_old_tl_id, v_old_date);
            END IF;
        END IF;
    END IF;

    -- HANDLE INSERTIONS & UPDATES (New State)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION') AND NEW.mode = 'ADD' THEN
            SELECT team_leader_id INTO v_new_tl_id FROM public.riders WHERE id = NEW.rider_id;
            v_new_date := COALESCE(
                public.extract_ist_date(NEW.metadata->>'date_on_sheet'),
                (NEW.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
                (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
            );
            IF v_new_tl_id IS NOT NULL THEN
                PERFORM public.recalculate_daily_collection_for_date(v_new_tl_id, v_new_date);
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics_v17();

-- ────────────────────────────────────────────────────────────────────────────
-- STEP 4: IMMEDIATE FULL RECALCULATION — fixes Aftab + all other TLs TODAY
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_tl_id UUID;
BEGIN
    RAISE NOTICE 'Recalculating daily_collections for date: %', v_today;
    
    -- Loop over all TLs that have ANY collection entry that resolves to today (IST)
    FOR v_tl_id IN
        SELECT DISTINCT r.team_leader_id
        FROM public.wallet_ledger wl
        JOIN public.riders r ON wl.rider_id = r.id
        WHERE wl.mode = 'ADD'
          AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION')
          AND r.team_leader_id IS NOT NULL
          AND COALESCE(
                public.extract_ist_date(wl.metadata->>'date_on_sheet'),
                (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
                (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
              ) = v_today
    LOOP
        PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_today);
        RAISE NOTICE 'Recalculated TL: %', v_tl_id;
    END LOOP;
    
    RAISE NOTICE 'Done! Check daily_collections for today.';
END $$;

-- Verify: show today's daily_collections totals
SELECT 
    u.full_name as tl_name,
    dc.date,
    dc.total_collection
FROM public.daily_collections dc
JOIN public.users u ON u.id = dc.team_leader_id
WHERE dc.date = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
ORDER BY dc.total_collection DESC;

COMMIT;
