-- ════════════════════════════════════════════════════════════════════════════
-- DEFINITIVE FIX: Wallet Balance 100% Accuracy
-- Version: FINAL
--
-- THE REAL ROOT CAUSE (Why previous fixes failed):
--   The bulk-import file contains the FINAL balance from the source platform
--   (Swiggy / Zomato / Rapido portal) at the time of export — this number
--   ALREADY includes all collections earned so far.
--
--   Old calculate_rider_balance used transaction_date to find ADDs, which meant
--   ALL of today's DAILY_COLLECTION ADD entries were summed on top of the RESET.
--   Result:  balance = ₹500 (RESET) + ₹200 (today's collections)  = ₹700 ❌
--            But correct balance = ₹500 (portal already has ₹200 inside it) ✅
--
-- THE CORRECT MODEL:
--   RESET entry created_at = the exact moment of import (e.g. 14:20 IST).
--   Only ADDs with created_at STRICTLY AFTER that moment are new/unaccounted.
--   Balance = RESET_amount + SUM(ADDs after RESET.created_at)
--           − SUM(SUBTRACTs after RESET.created_at)
--
-- HOW TO RUN: Paste ENTIRE script in Supabase SQL Editor → Run All.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: DEFINITIVE calculate_rider_balance
--   Uses RESET/SET created_at as the hard cutoff for subsequent ADDs.
--   No more transaction_date ambiguity.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_rider_balance(p_rider_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reset_amount  NUMERIC := 0;
    v_reset_ts      TIMESTAMPTZ := '2000-01-01 00:00:00+00'::TIMESTAMPTZ;
    v_adds          NUMERIC := 0;
    v_subtracts     NUMERIC := 0;
    v_reset_row     RECORD;
BEGIN
    -- A. Find the most-recent RESET or SET entry.
    --    Order by created_at DESC (actual insertion time — source of truth).
    SELECT amount, created_at
    INTO   v_reset_row
    FROM   public.wallet_ledger
    WHERE  rider_id = p_rider_id
      AND  mode IN ('RESET', 'SET')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_reset_row IS NOT NULL THEN
        v_reset_amount := v_reset_row.amount;
        v_reset_ts     := v_reset_row.created_at;  -- hard cutoff timestamp
    END IF;

    -- B. Sum ADDs created STRICTLY AFTER the RESET (post-import collections).
    --    Collections from before the import are already inside the RESET amount.
    SELECT COALESCE(SUM(amount), 0) INTO v_adds
    FROM   public.wallet_ledger
    WHERE  rider_id   = p_rider_id
      AND  mode       = 'ADD'
      AND  created_at > v_reset_ts;

    -- C. Sum SUBTRACTs created STRICTLY AFTER the RESET (post-import adjustments).
    SELECT COALESCE(SUM(amount), 0) INTO v_subtracts
    FROM   public.wallet_ledger
    WHERE  rider_id   = p_rider_id
      AND  mode       = 'SUBTRACT'
      AND  created_at > v_reset_ts;

    RETURN v_reset_amount + v_adds - v_subtracts;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: DEFINITIVE handle_daily_wallet_update
--   • Deletes stale previous-day RESET entries.
--   • Upserts today's RESET with created_at = NOW() (the import timestamp).
--   • Forces wallet_amount = calculated balance immediately (no drift).
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
    v_deleted_count INTEGER;
    v_ledger_id     UUID;
    v_final_balance NUMERIC;
BEGIN
    -- 1. Resolve today in IST
    v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    -- 2. Auto-cleanup: delete ALL previous-date RESET/DAY_OPENING_BALANCE entries
    DELETE FROM public.wallet_ledger wl
    WHERE wl.rider_id         = p_rider_id
      AND wl.mode             = 'RESET'
      AND wl.transaction_type = 'DAY_OPENING_BALANCE'
      AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE < v_today_ist;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- 3. Upsert today's RESET entry.
    --    created_at = NOW() acts as the import timestamp cutoff.
    --    transaction_date = p_date stored for audit purposes only.
    INSERT INTO public.wallet_ledger (
        rider_id,
        amount,
        transaction_type,
        mode,
        description,
        metadata,
        external_transaction_id,
        created_at,
        transaction_date,
        source_type
    ) VALUES (
        p_rider_id,
        p_new_balance,
        'DAY_OPENING_BALANCE',
        'RESET',
        'Bulk wallet update — source platform balance',
        jsonb_build_object(
            'source',              'bulk_wallet_update',
            'ist_date',            v_today_ist::TEXT,
            'import_time_ist',     (NOW() AT TIME ZONE 'Asia/Kolkata')::TEXT,
            'cleaned_old_entries', v_deleted_count
        ),
        COALESCE(p_external_id, 'RESET_' || p_rider_id::TEXT || '_' || v_today_ist::TEXT),
        NOW(),    -- ★ created_at = exact import timestamp (cutoff for balance calc)
        COALESCE(p_date, NOW()),
        'RESET'
    )
    ON CONFLICT (external_transaction_id)
    DO UPDATE SET
        amount           = EXCLUDED.amount,
        metadata         = EXCLUDED.metadata,
        created_at       = NOW(),   -- ★ Re-anchor cutoff to new import time
        transaction_date = EXCLUDED.transaction_date
    RETURNING id INTO v_ledger_id;

    -- 4. Calculate the correct final balance using the updated function.
    --    After the RESET insert, only ADDs with created_at > NOW() will be added.
    --    Since there can be none yet, v_final_balance = p_new_balance exactly.
    v_final_balance := public.calculate_rider_balance(p_rider_id);

    -- 5. Write the authoritative balance directly to riders table.
    UPDATE public.riders
    SET wallet_amount = v_final_balance,
        updated_at    = NOW()
    WHERE id = p_rider_id;

    RETURN jsonb_build_object(
        'success',      true,
        'ledger_id',    v_ledger_id,
        'old_deleted',  v_deleted_count,
        'new_balance',  v_final_balance,
        'ist_date',     v_today_ist
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Update sync_wallet_balance_for_rider (helper used by trigger)
--   Ensures it uses the same definitive calculate_rider_balance above.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_wallet_balance_for_rider(p_rider_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.riders
    SET wallet_amount = public.calculate_rider_balance(p_rider_id),
        updated_at    = NOW()
    WHERE id = p_rider_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Full balance resync — recalculate wallet_amount for ALL riders
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
-- VERIFICATION — run these SELECT queries SEPARATELY after the above to confirm
-- ─────────────────────────────────────────────────────────────────────────────

-- Query 1: Check for any drift between cached and recalculated balance.
-- Expected: All rows show drift = 0.
--
-- SELECT
--     r.rider_name,
--     r.wallet_amount                        AS cached_balance,
--     public.calculate_rider_balance(r.id)   AS recalculated_balance,
--     r.wallet_amount
--       - public.calculate_rider_balance(r.id) AS drift
-- FROM public.riders r
-- WHERE r.status = 'active'
-- ORDER BY ABS(r.wallet_amount - public.calculate_rider_balance(r.id)) DESC
-- LIMIT 30;

-- Query 2: Show wallet_ledger entries for a specific rider to audit the model.
-- Replace 'RIDER_ID_HERE' with an actual rider UUID.
--
-- SELECT mode, transaction_type, amount, source_type, created_at, transaction_date
-- FROM public.wallet_ledger
-- WHERE rider_id = 'RIDER_ID_HERE'
-- ORDER BY created_at DESC
-- LIMIT 20;
