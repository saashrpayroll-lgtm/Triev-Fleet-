-- SMART WALLET CLEANUP
-- Automatically removes old 'DAY_OPENING_BALANCE' entries while keeping today's data and the latest baseline.

-- 1. UPDATED MANUAL RPC
CREATE OR REPLACE FUNCTION public.cleanup_wallet_ledger()
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- We delete 'DAY_OPENING_BALANCE' (RESET) entries that are:
    -- A. Older than today (current date)
    -- B. NOT the absolute latest baseline for that rider (essential for balance calculation)
    
    WITH latest_resets AS (
        SELECT DISTINCT ON (rider_id) id
        FROM public.wallet_ledger
        WHERE mode = 'RESET'
        ORDER BY rider_id, transaction_date DESC, created_at DESC
    )
    DELETE FROM public.wallet_ledger
    WHERE mode = 'RESET'
      AND transaction_type = 'DAY_OPENING_BALANCE'
      AND (transaction_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
      AND id NOT IN (SELECT id FROM latest_resets);

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'message', 'Historical opening balances cleaned up while preserving latest baselines.'
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
BEGIN
    -- When a new 'RESET' (opening balance) is added for a rider
    IF NEW.mode = 'RESET' AND NEW.transaction_type = 'DAY_OPENING_BALANCE' THEN
        -- Delete older 'RESET' entries for this rider that are NOT from today
        -- (Safety: Never delete the entry being inserted)
        DELETE FROM public.wallet_ledger
        WHERE rider_id = NEW.rider_id
          AND mode = 'RESET'
          AND transaction_type = 'DAY_OPENING_BALANCE'
          AND id <> NEW.id
          AND (transaction_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE < (NEW.transaction_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. ATTACH AUTOMATIC TRIGGER
DROP TRIGGER IF EXISTS trg_auto_cleanup_wallet ON public.wallet_ledger;
CREATE TRIGGER trg_auto_cleanup_wallet
AFTER INSERT ON public.wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_auto_cleanup_wallet_ledger();
