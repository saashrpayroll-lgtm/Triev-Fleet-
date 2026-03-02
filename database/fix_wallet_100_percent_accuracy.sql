-- ════════════════════════════════════════════════════════════════════════════
-- FINAL CORRECT FIX: Wallet Balance = DAY_OPENING_BALANCE only
--
-- BUSINESS RULE (confirmed):
--   • riders.wallet_amount = Latest DAY_OPENING_BALANCE (RESET) value only.
--   • DAILY_COLLECTION entries are for TL collection tracking ONLY.
--   • DAILY_COLLECTION must NOT be added to wallet balance.
--
-- HOW TO RUN: Paste entire script in Supabase SQL Editor → Run All.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Fix calculate_rider_balance
--   Returns ONLY the latest RESET/SET (DAY_OPENING_BALANCE) amount.
--   DAILY_COLLECTION ADDs are completely ignored for wallet balance.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_rider_balance(p_rider_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance NUMERIC := 0;
BEGIN
    -- Wallet balance = the latest RESET (DAY_OPENING_BALANCE) amount only.
    -- DAILY_COLLECTION is NOT part of wallet balance.
    SELECT COALESCE(amount, 0)
    INTO   v_balance
    FROM   public.wallet_ledger
    WHERE  rider_id = p_rider_id
      AND  mode IN ('RESET', 'SET')
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN COALESCE(v_balance, 0);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Fix handle_daily_wallet_update (clean & simple)
--   Sets wallet_amount = p_new_balance directly (no calculation needed).
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
BEGIN
    -- 1. Today's date in IST
    v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    -- 2. Delete stale previous-date RESET entries for this rider
    DELETE FROM public.wallet_ledger wl
    WHERE wl.rider_id         = p_rider_id
      AND wl.mode             = 'RESET'
      AND wl.transaction_type = 'DAY_OPENING_BALANCE'
      AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE < v_today_ist;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- 3. Upsert today's DAY_OPENING_BALANCE entry
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
        'Bulk wallet update',
        jsonb_build_object(
            'source',    'bulk_wallet_update',
            'ist_date',  v_today_ist::TEXT,
            'cleaned',   v_deleted_count
        ),
        COALESCE(p_external_id, 'RESET_' || p_rider_id::TEXT || '_' || v_today_ist::TEXT),
        NOW(),
        COALESCE(p_date, NOW()),
        'RESET'
    )
    ON CONFLICT (external_transaction_id)
    DO UPDATE SET
        amount           = EXCLUDED.amount,
        metadata         = EXCLUDED.metadata,
        created_at       = NOW()
    RETURNING id INTO v_ledger_id;

    -- 4. Directly set wallet_amount = the imported balance (no calculation needed)
    UPDATE public.riders
    SET wallet_amount = p_new_balance,
        updated_at    = NOW()
    WHERE id = p_rider_id;

    RETURN jsonb_build_object(
        'success',     true,
        'ledger_id',   v_ledger_id,
        'old_deleted', v_deleted_count,
        'new_balance', p_new_balance,
        'ist_date',    v_today_ist
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Fix sync_wallet_balance_for_rider helper
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
-- STEP 4: Fix the wallet_ledger trigger — DAILY_COLLECTION must NOT touch
--   riders.wallet_amount. Only RESET/SET entries update the balance.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_wallet_ledger_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- ★ Only sync wallet balance when a RESET or SET entry changes.
    -- DAILY_COLLECTION / MANUAL_ADJUSTMENT ADDs do NOT affect wallet_amount.
    IF TG_OP = 'DELETE' THEN
        IF OLD.mode IN ('RESET', 'SET') THEN
            PERFORM public.sync_wallet_balance_for_rider(OLD.rider_id);
        END IF;
        RETURN OLD;
    ELSE
        IF NEW.mode IN ('RESET', 'SET') THEN
            PERFORM public.sync_wallet_balance_for_rider(NEW.rider_id);
        END IF;
        RETURN NEW;
    END IF;
END;
$$;

-- Re-attach the trigger with the updated function
DROP TRIGGER IF EXISTS trg_wallet_ledger_main_sync ON public.wallet_ledger;
CREATE TRIGGER trg_wallet_ledger_main_sync
AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION public.trigger_wallet_ledger_sync();

-- Also replace old trigger names in case any still exist
DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.wallet_ledger;
DROP TRIGGER IF EXISTS trg_update_wallet_balance ON public.wallet_ledger;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Full resync — set wallet_amount = latest RESET for all riders
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.riders r
SET wallet_amount = COALESCE(
    (
        SELECT wl.amount
        FROM   public.wallet_ledger wl
        WHERE  wl.rider_id = r.id
          AND  wl.mode IN ('RESET', 'SET')
        ORDER BY wl.created_at DESC
        LIMIT 1
    ),
    0  -- no RESET entry found → keep 0
),
updated_at = NOW()
WHERE r.status = 'active';
