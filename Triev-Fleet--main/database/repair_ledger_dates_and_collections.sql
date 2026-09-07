-- ═══════════════════════════════════════════════════════════════════════════════
-- MASTER SCRIPT: Repair Inverted Dates in wallet_ledger + Full Collections Sync
-- Run this ENTIRE script in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Correct any inverted transaction_date in wallet_ledger
-- (e.g. Month & Day were swapped: Month=7/1/2/3 instead of Month=9 for Sept transactions)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.wallet_ledger
SET transaction_date = make_timestamptz(
    EXTRACT(YEAR FROM transaction_date AT TIME ZONE 'Asia/Kolkata')::INT,
    EXTRACT(DAY FROM transaction_date AT TIME ZONE 'Asia/Kolkata')::INT,   -- Inverted Month (e.g. 9 for Sept)
    EXTRACT(MONTH FROM transaction_date AT TIME ZONE 'Asia/Kolkata')::INT, -- Inverted Day (e.g. 1..7)
    12, 0, 0, 'Asia/Kolkata'
)
WHERE EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata') = 9
  AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata') = 2026
  AND transaction_date IS NOT NULL
  AND EXTRACT(DAY FROM transaction_date AT TIME ZONE 'Asia/Kolkata') = 9
  AND EXTRACT(MONTH FROM transaction_date AT TIME ZONE 'Asia/Kolkata') != 9
  AND EXTRACT(MONTH FROM transaction_date AT TIME ZONE 'Asia/Kolkata') <= 12;

-- If transaction_date is in the future, clamp it to created_at
UPDATE public.wallet_ledger
SET transaction_date = created_at
WHERE transaction_date > (NOW() AT TIME ZONE 'Asia/Kolkata');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Define / Update the canonical ledger_effective_date() helper
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ledger_effective_date(p_row public.wallet_ledger)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(
        CASE 
            WHEN p_row.metadata->>'date_on_sheet' IS NOT NULL 
                 AND p_row.metadata->>'date_on_sheet' ~ '^\d{4}-\d{2}-\d{2}'
            THEN ((p_row.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE
        END,
        CASE
            WHEN p_row.transaction_date IS NOT NULL
            THEN (p_row.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE
        END,
        (p_row.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update recalculate_daily_collection_for_date()
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
-- 4. Full resync function to rebuild all historical collections
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resync_all_daily_collections()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rows INTEGER := 0;
BEGIN
    WITH base_data AS (
        SELECT
            r.team_leader_id,
            public.ledger_effective_date(wl) AS eff_date,
            wl.amount
        FROM public.wallet_ledger wl
        JOIN public.riders r ON wl.rider_id = r.id
        WHERE wl.mode = 'ADD'
          AND wl.transaction_type IN (
              'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
              'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
              'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
              'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
              'rent', 'recharge', 'wallet_recharge'
          )
          AND r.team_leader_id IS NOT NULL
          AND public.ledger_effective_date(wl) IS NOT NULL
          AND public.ledger_effective_date(wl) <= (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
    )
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    SELECT
        bd.team_leader_id,
        bd.eff_date,
        SUM(bd.amount) AS total_col,
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

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Run resync immediately
-- ─────────────────────────────────────────────────────────────────────────────
SELECT public.resync_all_daily_collections();
