-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: active_riders_count not decreasing on same-day submission
-- 
-- Problem: The ON CONFLICT clause used GREATEST(EXCLUDED, existing) which
--          only ratchets the count UP, never DOWN. When a rider is submitted
--          on the same day after an earlier sync wrote a higher count, the
--          count stays at the old (higher) value.
--
-- Fix: Replace GREATEST with the newly calculated count (EXCLUDED), since
--      the recalculate function always computes the true count from scratch.
--
-- Also recreates recalculate_daily_collection_for_date() for correctness.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: recalculate_daily_collection_for_date — always use the freshly
-- computed count, not GREATEST(new, old)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_daily_collection_for_date(p_tl_id UUID, p_date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total   NUMERIC;
    v_riders  INTEGER;
BEGIN
    -- Sum all collection-type ADD entries for this TL on this date
    SELECT COALESCE(SUM(wl.amount), 0) INTO v_total
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE r.team_leader_id = p_tl_id
      AND wl.mode = 'ADD'
      AND wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
      AND public.ledger_effective_date(wl) = p_date;

    -- Historical active rider count on that date
    -- A rider is active on p_date if:
    --   1. Was created/allotted on or before p_date
    --   2. Was NOT inactivated, OR was inactivated AFTER p_date (strict >)
    SELECT GREATEST(COUNT(*)::INTEGER, 1) INTO v_riders
    FROM public.riders
    WHERE team_leader_id = p_tl_id
      AND status != 'deleted'
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= p_date
      AND (inactivated_at IS NULL OR (inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > p_date);

    IF v_total = 0 THEN
        -- Preserve row but zero out collection
        UPDATE public.daily_collections
        SET total_collection = 0,
            active_riders_count = v_riders,
            updated_at = NOW()
        WHERE team_leader_id = p_tl_id AND date = p_date;
    ELSE
        INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
        VALUES (p_tl_id, p_date, v_total, v_riders, NOW())
        ON CONFLICT (team_leader_id, date) DO UPDATE SET
            total_collection    = EXCLUDED.total_collection,
            -- ✅ FIX: Always use the freshly computed count, not GREATEST
            -- GREATEST prevented the count from decreasing on same-day submissions
            active_riders_count = EXCLUDED.active_riders_count,
            updated_at          = NOW();
    END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: snapshot_daily_collections — same GREATEST fix
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.snapshot_daily_collections()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ist_today DATE;
    v_upserted  INTEGER;
BEGIN
    v_ist_today := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    SELECT
        r.team_leader_id,
        v_ist_today,
        COALESCE(SUM(wl.amount), 0),
        GREATEST(COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END)::INTEGER, 1),
        NOW()
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE wl.mode = 'ADD'
      AND wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
      AND r.team_leader_id IS NOT NULL
      AND public.ledger_effective_date(wl) = v_ist_today
    GROUP BY r.team_leader_id
    ON CONFLICT (team_leader_id, date) DO UPDATE SET
        total_collection    = EXCLUDED.total_collection,
        -- ✅ FIX: Always use fresh count, not GREATEST
        active_riders_count = EXCLUDED.active_riders_count,
        updated_at          = NOW();

    GET DIAGNOSTICS v_upserted = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'date', v_ist_today,
        'rows_upserted', v_upserted,
        'message', 'Snapshot complete for ' || v_ist_today::TEXT
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: resync_all_daily_collections — same GREATEST fix
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resync_all_daily_collections()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rows INTEGER;
BEGIN
    TRUNCATE TABLE public.daily_collections;

    WITH base_data AS (
        SELECT 
            r.team_leader_id,
            public.ledger_effective_date(wl) AS eff_date,
            wl.amount
        FROM public.wallet_ledger wl
        JOIN public.riders r ON wl.rider_id = r.id
        WHERE wl.mode = 'ADD'
          AND wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
          AND r.team_leader_id IS NOT NULL
    )
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    SELECT
        bd.team_leader_id,
        bd.eff_date,
        SUM(bd.amount) AS total,
        GREATEST(
            (
                SELECT COUNT(*)::INTEGER
                FROM public.riders r2
                WHERE r2.team_leader_id = bd.team_leader_id
                  AND r2.status != 'deleted'
                  AND (r2.created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= bd.eff_date
                  AND (r2.inactivated_at IS NULL OR (r2.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > bd.eff_date)
            ),
            1
        ) AS rider_count,
        NOW() AS updated_at
    FROM base_data bd
    GROUP BY bd.team_leader_id, bd.eff_date
    ON CONFLICT (team_leader_id, date) DO UPDATE SET
        total_collection    = EXCLUDED.total_collection,
        -- ✅ FIX: Always use fresh count
        active_riders_count = EXCLUDED.active_riders_count,
        updated_at          = NOW();

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'rows_rebuilt', v_rows,
        'message', 'Full resync complete. ' || v_rows || ' daily_collection rows rebuilt.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- After running the above, run a full resync to fix all historical data:
-- SELECT public.resync_all_daily_collections();
-- ═══════════════════════════════════════════════════════════════════════════════
