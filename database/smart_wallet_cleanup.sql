-- AGGRESSIVE WALLET HISTORY CLEANUP (V2)
-- Strictly keeps only current-day 'DAY_OPENING_BALANCE' entries.
-- Automatically carries forward old baselines to today before deletion to preserve accurate balances.

-- 1. UPDATED MANUAL RPC
CREATE OR REPLACE FUNCTION public.cleanup_wallet_ledger()
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_carry_forward_count INTEGER := 0;
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
    -- STEP A: Identify riders whose LATEST baseline is older than today 
    -- and carry that balance forward to today.
    -- This prevents their balance from jumping to 0 when the old record is deleted.
    
    WITH latest_old_baselines AS (
        SELECT DISTINCT ON (rider_id) 
            rider_id, amount, transaction_date, description, source_type
        FROM public.wallet_ledger
        WHERE mode IN ('SET', 'RESET')
          AND transaction_type = 'DAY_OPENING_BALANCE'
          AND (transaction_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE < v_today
        ORDER BY rider_id, transaction_date DESC, created_at DESC
    ),
    riders_needing_carry AS (
        -- Only carry forward for riders who DO NOT ALREADY HAVE a baseline for today
        SELECT lob.* 
        FROM latest_old_baselines lob
        LEFT JOIN public.wallet_ledger today_ledger
          ON lob.rider_id = today_ledger.rider_id
          AND today_ledger.mode IN ('SET', 'RESET')
          AND today_ledger.transaction_type = 'DAY_OPENING_BALANCE'
          AND (today_ledger.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE = v_today
        WHERE today_ledger.id IS NULL
    )
    INSERT INTO public.wallet_ledger (
        rider_id, transaction_type, mode, amount, description, source_type, transaction_date, external_transaction_id
    )
    SELECT 
        rider_id, 
        'DAY_OPENING_BALANCE', 
        'RESET', 
        amount, 
        'System Balance Carry Forward (Continuity)', 
        'SYSTEM', 
        v_today + time '00:00:01', -- Just past midnight today
        'CARRY_' || rider_id || '_' || v_today
    FROM riders_needing_carry
    ON CONFLICT (external_transaction_id) DO NOTHING;

    GET DIAGNOSTICS v_carry_forward_count = ROW_COUNT;

    -- STEP B: Aggressively delete ALL 'DAY_OPENING_BALANCE' entries older than today.
    -- (Safety: Both SET and RESET modes included)
    DELETE FROM public.wallet_ledger
    WHERE mode IN ('SET', 'RESET')
      AND transaction_type = 'DAY_OPENING_BALANCE'
      AND (transaction_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE < v_today;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'carry_forward_count', v_carry_forward_count,
        'message', 'Strict cleanup complete. Only current day opening balances remain.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. AUTOMATIC CLEANUP TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.trg_fn_auto_cleanup_wallet_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
    -- When a new 'RESET' or 'SET' (opening balance) is added for a rider
    IF NEW.mode IN ('SET', 'RESET') AND NEW.transaction_type = 'DAY_OPENING_BALANCE' THEN
        -- Delete ALL older 'DAY_OPENING_BALANCE' entries for this rider that are NOT from today
        -- (Safety: Never delete the entry being inserted)
        DELETE FROM public.wallet_ledger
        WHERE rider_id = NEW.rider_id
          AND mode IN ('SET', 'RESET')
          AND transaction_type = 'DAY_OPENING_BALANCE'
          AND id <> NEW.id
          AND (transaction_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE < v_today;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. ATTACH AUTOMATIC TRIGGER (Same as before)
DROP TRIGGER IF EXISTS trg_auto_cleanup_wallet ON public.wallet_ledger;
CREATE TRIGGER trg_auto_cleanup_wallet
AFTER INSERT ON public.wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_auto_cleanup_wallet_ledger();
