-- ═══════════════════════════════════════════════════════════════════════════════
-- PERMANENT COLLECTION SYNC FIX — v1.0
-- Run this ENTIRE script in the Supabase SQL Editor once.
-- This permanently fixes:
--   1. wallet_ledger UPDATE not syncing to daily_collections (CORE BUG)
--   2. snapshot_daily_collections() using created_at instead of canonical date
--   3. Provides resync_all_daily_collections() to rebuild from scratch anytime
--   4. Full data resync at the end
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: Canonical "effective date" for a ledger row (IST-aware)
-- Priority: metadata.date_on_sheet → transaction_date → created_at
-- All cast to IST (Asia/Kolkata = UTC+5:30)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ledger_effective_date(p_row public.wallet_ledger)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(
        -- 1. Explicit sheet date set during bulk import / date edit
        CASE 
            WHEN p_row.metadata->>'date_on_sheet' IS NOT NULL 
                 AND p_row.metadata->>'date_on_sheet' ~ '^\d{4}-\d{2}-\d{2}'
            THEN (p_row.metadata->>'date_on_sheet')::DATE
        END,
        -- 2. transaction_date column (stored as timestamptz, cast to IST)
        CASE
            WHEN p_row.transaction_date IS NOT NULL
            THEN (p_row.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE
        END,
        -- 3. Fallback: created_at in IST
        (p_row.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    )
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- CORE HELPER: Recalculate and upsert daily_collections for ONE TL + ONE DATE
-- Called by all triggers and RPCs. Always rebuilds from wallet_ledger directly.
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
        -- If no row existed, nothing to do (no insert of a zero row)
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
-- TRIGGER FUNCTION: Fires on INSERT, UPDATE, DELETE of wallet_ledger
-- Handles all date fields (created_at, transaction_date, metadata.date_on_sheet)
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
        IF NEW.mode = 'ADD' AND NEW.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION') THEN
            SELECT team_leader_id INTO v_tl_id_new FROM public.riders WHERE id = NEW.rider_id;
            IF v_tl_id_new IS NOT NULL THEN
                v_date_new := public.ledger_effective_date(NEW);
                PERFORM public.recalculate_daily_collection_for_date(v_tl_id_new, v_date_new);
            END IF;
        END IF;
        RETURN NEW;

    -- ── DELETE ────────────────────────────────────────────────────────────────
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.mode = 'ADD' AND OLD.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION') THEN
            SELECT team_leader_id INTO v_tl_id_old FROM public.riders WHERE id = OLD.rider_id;
            IF v_tl_id_old IS NOT NULL THEN
                v_date_old := public.ledger_effective_date(OLD);
                PERFORM public.recalculate_daily_collection_for_date(v_tl_id_old, v_date_old);
            END IF;
        END IF;
        RETURN OLD;

    -- ── UPDATE ── ★ THIS IS THE MISSING PIECE — THE CORE BUG FIX ★ ──────────
    -- When ANY field of a ledger row changes (amount, created_at, transaction_date,
    -- metadata.date_on_sheet), we recalculate BOTH the old date AND the new date.
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.mode = 'ADD' AND OLD.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION') THEN
            SELECT team_leader_id INTO v_tl_id_old FROM public.riders WHERE id = OLD.rider_id;
            IF v_tl_id_old IS NOT NULL THEN
                v_date_old := public.ledger_effective_date(OLD);
                PERFORM public.recalculate_daily_collection_for_date(v_tl_id_old, v_date_old);
            END IF;
        END IF;

        IF NEW.mode = 'ADD' AND NEW.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION') THEN
            SELECT team_leader_id INTO v_tl_id_new FROM public.riders WHERE id = NEW.rider_id;
            IF v_tl_id_new IS NOT NULL THEN
                v_date_new := public.ledger_effective_date(NEW);
                -- Only recalculate new date if different from old (avoid double work)
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
-- RECREATE TRIGGER — Now handles INSERT + UPDATE + DELETE
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;

CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();


-- ─────────────────────────────────────────────────────────────────────────────
-- ALSO fix snapshot_daily_collections() — was using created_at IST (wrong).
-- Now uses ledger_effective_date() which respects date_on_sheet + transaction_date.
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

    -- Upsert using canonical effective date (respects date_on_sheet)
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
      AND public.ledger_effective_date(wl) = v_ist_today   -- ★ FIX: use canonical date
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


-- ─────────────────────────────────────────────────────────────────────────────
-- NEW RPC: resync_all_daily_collections()
-- Full rebuild of daily_collections from wallet_ledger.
-- Call anytime data looks wrong. Safe to run repeatedly.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resync_all_daily_collections()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rows INTEGER;
BEGIN
    -- Truncate and rebuild from scratch
    TRUNCATE TABLE public.daily_collections;

    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    SELECT
        r.team_leader_id,
        public.ledger_effective_date(wl) AS eff_date,
        SUM(wl.amount)                   AS total,
        GREATEST(
            (
                SELECT COUNT(*)::INTEGER
                FROM public.riders r2
                WHERE r2.team_leader_id = r.team_leader_id
                  AND r2.status != 'deleted'
                  AND (r2.created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= public.ledger_effective_date(wl)
                  AND (r2.inactivated_at IS NULL OR (r2.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > public.ledger_effective_date(wl))
            ),
            1
        ) AS rider_count
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE wl.mode = 'ADD'
      AND wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
      AND r.team_leader_id IS NOT NULL
    GROUP BY r.team_leader_id, public.ledger_effective_date(wl)
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
-- ALSO ENSURE: update_wallet_transaction_date() uses ledger_effective_date()
-- (not the old safe_cast_to_date + fallback chain)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_wallet_transaction_date(
    p_transaction_id UUID,
    p_new_date       TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_row   public.wallet_ledger%ROWTYPE;
    v_tl_id     UUID;
    v_old_date  DATE;
    v_new_date  DATE := (p_new_date AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
    -- Permission check
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can modify transaction dates.';
    END IF;

    -- Fetch row
    SELECT * INTO v_old_row FROM public.wallet_ledger WHERE id = p_transaction_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found.', p_transaction_id;
    END IF;

    v_old_date := public.ledger_effective_date(v_old_row);

    SELECT team_leader_id INTO v_tl_id FROM public.riders WHERE id = v_old_row.rider_id;

    -- Update the row: set all three date fields + metadata so canonical date resolves to new date
    UPDATE public.wallet_ledger
    SET
        created_at       = p_new_date,
        transaction_date = p_new_date,
        metadata         = jsonb_set(
                               jsonb_set(
                                   COALESCE(metadata, '{}'::jsonb),
                                   '{date_on_sheet}', to_jsonb(v_new_date::TEXT)
                               ),
                               '{date_modified_by}', to_jsonb(auth.uid()::TEXT)
                           ),
        updated_at       = NOW()
    WHERE id = p_transaction_id;
    -- NOTE: The UPDATE trigger (trg_sync_ledger_to_daily_metrics) will now
    --       automatically recalculate both old and new dates in daily_collections.

    RETURN jsonb_build_object(
        'success', true,
        'old_date', v_old_date,
        'new_date', v_new_date,
        'message', 'Date changed from ' || v_old_date || ' to ' || v_new_date || '. Metrics updated automatically.'
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BULK DATE UPDATE RPC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_update_wallet_transaction_date(
    p_transaction_ids UUID[],
    p_new_date        TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    txn_id         UUID;
    v_updated      INT := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can bulk modify transaction dates.';
    END IF;

    FOREACH txn_id IN ARRAY p_transaction_ids LOOP
        PERFORM public.update_wallet_transaction_date(txn_id, p_new_date);
        v_updated := v_updated + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated_count', v_updated,
        'message', v_updated || ' transactions updated. Metrics recalculated.'
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ★ FINAL STEP: FULL RESYNC — Fix ALL historical data NOW
-- This rebuilds daily_collections 100% from wallet_ledger using the canonical date logic.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.resync_all_daily_collections() AS resync_result;

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (run separately after the above)
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Check daily_collections for last 7 days:
-- SELECT date, COUNT(*) as tl_count, SUM(total_collection) as total
-- FROM daily_collections
-- WHERE date >= CURRENT_DATE - 7
-- GROUP BY date ORDER BY date DESC;

-- 2. Check today's specific data:
-- SELECT u.full_name, dc.date, dc.total_collection, dc.active_riders_count
-- FROM daily_collections dc
-- JOIN users u ON dc.team_leader_id = u.id
-- WHERE dc.date = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
-- ORDER BY dc.total_collection DESC;

-- 3. Test resync anytime:
-- SELECT public.resync_all_daily_collections();
