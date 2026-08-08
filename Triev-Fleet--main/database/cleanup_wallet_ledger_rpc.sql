-- Wallet History Cleanup RPC
-- This function deletes old 'DAY_OPENING_BALANCE' (RESET) entries while keeping the 
-- absolute latest one for each rider to ensure balance calculation remains intact.

CREATE OR REPLACE FUNCTION public.cleanup_wallet_ledger()
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- 1. Identify and delete redundant RESET entries
    -- We keep the latest RESET entry (max transaction_date/created_at) for each rider.
    
    WITH latest_resets AS (
        SELECT DISTINCT ON (rider_id) id
        FROM public.wallet_ledger
        WHERE mode = 'RESET'
        ORDER BY rider_id, transaction_date DESC, created_at DESC
    )
    DELETE FROM public.wallet_ledger
    WHERE mode = 'RESET'
      AND transaction_type = 'DAY_OPENING_BALANCE'
      AND id NOT IN (SELECT id FROM latest_resets);

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'message', 'Redundant opening balances cleaned up successfully.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
