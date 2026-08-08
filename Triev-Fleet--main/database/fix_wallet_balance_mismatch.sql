-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Wallet Balance Mismatch in TL & Admin Panels
--
-- ROOT CAUSE:
--   handle_daily_wallet_update sets RESET transaction_date = NOW() (e.g. 13:19 IST).
--   calculate_rider_balance sums ADDs only AFTER the RESET's transaction_date.
--   ➜ Any ADD entries made earlier today (before 13:19) get EXCLUDED from the
--     balance, so the balance shows only the raw RESET amount instead of
--     RESET + today's collections.
--
-- FIX STRATEGY:
--   1. Set RESET transaction_date = IST midnight of today (start of day).
--      This ensures ALL of today's ADD entries (which have today's date) are
--      counted AFTER the reset baseline anchor.
--   2. Fix calculate_rider_balance to use created_at as the tie-breaker when
--      transaction_date values are equal (instead of relying on transaction_date
--      alone which causes same-day collisions).
--   3. Re-run a full balance sync on all riders.
--
-- HOW TO RUN: Paste this entire script in Supabase SQL Editor → Run All.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Fix calculate_rider_balance
--   Uses IST midnight anchor for RESET baseline so same-day ADDs are included.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_rider_balance(p_rider_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reset_amount   NUMERIC := 0;
    v_reset_anchor   TIMESTAMPTZ;   -- The exact IST-midnight of the RESET's date
    v_adds           NUMERIC := 0;
    v_subtracts      NUMERIC := 0;
    v_reset_row      RECORD;
BEGIN
    -- A. Find the most-recent RESET/SET entry (by transaction_date DESC, then created_at DESC)
    SELECT amount,
           transaction_date,
           created_at
    INTO   v_reset_row
    FROM   public.wallet_ledger
    WHERE  rider_id = p_rider_id
      AND  mode IN ('RESET', 'SET')
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;

    IF v_reset_row IS NOT NULL THEN
        v_reset_amount := v_reset_row.amount;

        -- ★ KEY FIX: Anchor = IST MIDNIGHT of the RESET's transaction_date.
        --   This ensures ALL same-day ADD entries (made before or after the
        --   import time) are counted in the balance.
        v_reset_anchor := date_trunc(
            'day',
            v_reset_row.transaction_date AT TIME ZONE 'Asia/Kolkata'
        ) AT TIME ZONE 'Asia/Kolkata';
    ELSE
        -- No RESET found → balance starts from 0
        v_reset_amount := 0;
        v_reset_anchor := '2000-01-01 00:00:00+00'::TIMESTAMPTZ;
    END IF;

    -- B. Sum ADDs on or after the reset anchor date (same-day inclusive)
    SELECT COALESCE(SUM(wl.amount), 0) INTO v_adds
    FROM   public.wallet_ledger wl
    WHERE  wl.rider_id = p_rider_id
      AND  wl.mode = 'ADD'
      AND  (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE
           >= (v_reset_anchor AT TIME ZONE 'Asia/Kolkata')::DATE;

    -- C. Sum SUBTRACTs on or after the reset anchor date
    SELECT COALESCE(SUM(wl.amount), 0) INTO v_subtracts
    FROM   public.wallet_ledger wl
    WHERE  wl.rider_id = p_rider_id
      AND  wl.mode = 'SUBTRACT'
      AND  (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE
           >= (v_reset_anchor AT TIME ZONE 'Asia/Kolkata')::DATE;

    RETURN v_reset_amount + v_adds - v_subtracts;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Fix handle_daily_wallet_update
--   Sets RESET transaction_date = IST midnight of today (not the import moment).
--   This aligns with the new calculate_rider_balance logic above.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_daily_wallet_update(
    p_rider_id    UUID,
    p_new_balance NUMERIC,
    p_date        TIMESTAMPTZ,
    p_external_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today_ist     DATE;
    v_midnight_ist  TIMESTAMPTZ;   -- IST midnight = correct anchor for RESET
    v_deleted_count INTEGER;
    v_ledger_id     UUID;
BEGIN
    -- 1. Resolve today in IST
    v_today_ist    := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    -- 2. IST midnight of today (this is the RESET anchor)
    --    date_trunc('day', ...) gives midnight in that zone.
    v_midnight_ist := date_trunc(
        'day',
        NOW() AT TIME ZONE 'Asia/Kolkata'
    ) AT TIME ZONE 'Asia/Kolkata';

    -- 3. Auto-cleanup: delete ALL previous-date RESET entries for this rider
    DELETE FROM public.wallet_ledger wl
    WHERE wl.rider_id         = p_rider_id
      AND wl.mode             = 'RESET'
      AND wl.transaction_type = 'DAY_OPENING_BALANCE'
      AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE < v_today_ist;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- 4. Upsert today's RESET at IST MIDNIGHT (not current time)
    --    Using midnight ensures calculate_rider_balance includes ALL today's ADDs.
    INSERT INTO public.wallet_ledger (
        rider_id,
        amount,
        transaction_type,
        mode,
        description,
        metadata,
        external_transaction_id,
        created_at,
        transaction_date,   -- ★ Set to IST midnight (not NOW())
        source_type
    ) VALUES (
        p_rider_id,
        p_new_balance,
        'DAY_OPENING_BALANCE',
        'RESET',
        'Daily opening balance set via bulk wallet update',
        jsonb_build_object(
            'source',              'bulk_wallet_update',
            'ist_date',            v_today_ist::TEXT,
            'actual_import_time',  NOW()::TEXT,
            'cleaned_old_entries', v_deleted_count
        ),
        COALESCE(p_external_id, 'RESET_' || p_rider_id::TEXT || '_' || v_today_ist::TEXT),
        NOW(),              -- created_at = actual import time (for audit)
        v_midnight_ist,     -- transaction_date = IST midnight (for balance calc)
        'RESET'
    )
    ON CONFLICT (external_transaction_id)
    DO UPDATE SET
        amount           = EXCLUDED.amount,
        metadata         = EXCLUDED.metadata,
        created_at       = NOW(),
        transaction_date = v_midnight_ist   -- Re-anchor to midnight on correction
    RETURNING id INTO v_ledger_id;

    -- 5. Force sync riders.wallet_amount via calculate_rider_balance
    UPDATE public.riders
    SET wallet_amount = public.calculate_rider_balance(p_rider_id),
        updated_at    = NOW()
    WHERE id = p_rider_id;

    RETURN jsonb_build_object(
        'success',     true,
        'ledger_id',   v_ledger_id,
        'old_deleted', v_deleted_count,
        'new_balance', p_new_balance,
        'ist_date',    v_today_ist,
        'anchor',      v_midnight_ist
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Full balance resync for all active riders
--   Recalculates wallet_amount for every rider using the corrected logic.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.riders LOOP
        PERFORM public.sync_wallet_balance_for_rider(r.id);
    END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION (run after the above to confirm balances look correct)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT r.rider_name,
--        r.wallet_amount                        AS cached_balance,
--        public.calculate_rider_balance(r.id)   AS recalculated,
--        r.wallet_amount - public.calculate_rider_balance(r.id) AS drift
-- FROM public.riders r
-- WHERE r.status = 'active'
-- ORDER BY ABS(r.wallet_amount - public.calculate_rider_balance(r.id)) DESC
-- LIMIT 20;
-- Expected: drift = 0 for all rows.
