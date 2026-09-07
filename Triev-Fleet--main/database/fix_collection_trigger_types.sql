-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: Collection Trigger Transaction Type Filter
-- 
-- PROBLEM: The trigger `sync_ledger_to_daily_metrics()` only processes 4 types:
--   'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION'
-- 
-- But the frontend writes and queries 12+ types including:
--   'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
--   'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE', etc.
--
-- This causes collection entries with those types to NEVER sync to
-- daily_collections, making them invisible in all dashboard panels.
--
-- ALSO FIXES: recalculate_daily_collection_for_date() which has the same
-- narrow filter.
--
-- Run this ENTIRE script in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix recalculate_daily_collection_for_date() — add ALL collection types
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
    -- ★ FIX: Now includes ALL transaction types that the frontend writes/queries
    SELECT COALESCE(SUM(wl.amount), 0) INTO v_total
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE r.team_leader_id = p_tl_id
      AND wl.mode = 'ADD'
      AND wl.transaction_type IN (
          'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
          'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
          'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
          'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
          'rent', 'recharge', 'wallet_recharge'
      )
      AND public.ledger_effective_date(wl) = p_date;

    -- Historical active rider count on that date
    SELECT GREATEST(COUNT(*)::INTEGER, 1) INTO v_riders
    FROM public.riders
    WHERE team_leader_id = p_tl_id
      AND status != 'deleted'
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= p_date
      AND (inactivated_at IS NULL OR (inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > p_date);

    IF v_total = 0 THEN
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
            active_riders_count = GREATEST(EXCLUDED.active_riders_count, daily_collections.active_riders_count),
            updated_at          = NOW();
    END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fix sync_ledger_to_daily_metrics() trigger — add ALL collection types
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tl_id_new UUID;
    v_tl_id_old UUID;
    v_date_new  DATE;
    v_date_old  DATE;
BEGIN
    -- ── INSERT ────────────────────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
        -- ★ FIX: Expanded transaction_type filter to match ALL frontend types
        IF NEW.mode = 'ADD' AND NEW.transaction_type IN (
            'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
            'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
            'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
            'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
            'rent', 'recharge', 'wallet_recharge'
        ) THEN
            SELECT team_leader_id INTO v_tl_id_new FROM public.riders WHERE id = NEW.rider_id;
            IF v_tl_id_new IS NOT NULL THEN
                v_date_new := public.ledger_effective_date(NEW);
                PERFORM public.recalculate_daily_collection_for_date(v_tl_id_new, v_date_new);
            END IF;
        END IF;
        RETURN NEW;

    -- ── DELETE ────────────────────────────────────────────────────────────────
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.mode = 'ADD' AND OLD.transaction_type IN (
            'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
            'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
            'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
            'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
            'rent', 'recharge', 'wallet_recharge'
        ) THEN
            SELECT team_leader_id INTO v_tl_id_old FROM public.riders WHERE id = OLD.rider_id;
            IF v_tl_id_old IS NOT NULL THEN
                v_date_old := public.ledger_effective_date(OLD);
                PERFORM public.recalculate_daily_collection_for_date(v_tl_id_old, v_date_old);
            END IF;
        END IF;
        RETURN OLD;

    -- ── UPDATE ────────────────────────────────────────────────────────────────
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.mode = 'ADD' AND OLD.transaction_type IN (
            'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
            'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
            'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
            'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
            'rent', 'recharge', 'wallet_recharge'
        ) THEN
            SELECT team_leader_id INTO v_tl_id_old FROM public.riders WHERE id = OLD.rider_id;
            IF v_tl_id_old IS NOT NULL THEN
                v_date_old := public.ledger_effective_date(OLD);
                PERFORM public.recalculate_daily_collection_for_date(v_tl_id_old, v_date_old);
            END IF;
        END IF;

        IF NEW.mode = 'ADD' AND NEW.transaction_type IN (
            'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
            'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
            'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
            'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
            'rent', 'recharge', 'wallet_recharge'
        ) THEN
            SELECT team_leader_id INTO v_tl_id_new FROM public.riders WHERE id = NEW.rider_id;
            IF v_tl_id_new IS NOT NULL THEN
                v_date_new := public.ledger_effective_date(NEW);
                IF v_tl_id_old IS NULL OR v_tl_id_new != v_tl_id_old OR v_date_new != v_date_old THEN
                    PERFORM public.recalculate_daily_collection_for_date(v_tl_id_new, v_date_new);
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fix resync_all_daily_collections() — add ALL collection types
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
          -- ★ FIX: Expanded to include ALL collection types
          AND wl.transaction_type IN (
              'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
              'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
              'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
              'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
              'rent', 'recharge', 'wallet_recharge'
          )
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
        active_riders_count = GREATEST(EXCLUDED.active_riders_count, 1),
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fix snapshot_daily_collections() — add ALL collection types
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
      -- ★ FIX: Expanded to include ALL collection types
      AND wl.transaction_type IN (
          'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
          'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
          'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
          'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
          'rent', 'recharge', 'wallet_recharge'
      )
      AND r.team_leader_id IS NOT NULL
      AND public.ledger_effective_date(wl) = v_ist_today
    GROUP BY r.team_leader_id
    ON CONFLICT (team_leader_id, date) DO UPDATE SET
        total_collection    = EXCLUDED.total_collection,
        active_riders_count = GREATEST(EXCLUDED.active_riders_count, daily_collections.active_riders_count),
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

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- ★ FINAL STEP: FULL RESYNC — Rebuild ALL historical daily_collections
-- This fixes all panels that weren't showing collection data.
-- Run this AFTER the above transaction completes.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.resync_all_daily_collections() AS resync_result;
