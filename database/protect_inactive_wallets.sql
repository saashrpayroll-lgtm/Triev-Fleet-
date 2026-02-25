-- =========================================================================================
-- FIX: PROTECT INACTIVE RIDER WALLETS FROM BULK UPDATES
-- =========================================================================================
-- Objective: Ensure that once a rider is inactivated (balance 0), automated imports 
-- do not overwrite their balance with old data.
-- =========================================================================================

BEGIN;

-- 1. Update handle_daily_wallet_update to skip inactive riders
CREATE OR REPLACE FUNCTION public.handle_daily_wallet_update(
    p_rider_id UUID,
    p_new_balance NUMERIC,
    p_date TIMESTAMPTZ,
    p_external_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_system_balance NUMERIC;
    v_diff NUMERIC;
    v_ext_id TEXT;
BEGIN
    -- [NEW] Check if rider is inactive. If so, skip automated updates.
    IF EXISTS (SELECT 1 FROM public.riders WHERE id = p_rider_id AND status = 'inactive') THEN
        RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Rider is inactive');
    END IF;

    -- 2. Get Current System Balance
    v_current_system_balance := public.calculate_rider_balance(p_rider_id);
    
    -- 3. Compare
    v_diff := p_new_balance - v_current_system_balance;

    -- 4. Log Mismatch if exists
    IF v_diff <> 0 THEN
        INSERT INTO public.wallet_mismatches (
            rider_id, system_balance, source_balance, difference, mismatch_date
        ) VALUES (
            p_rider_id, v_current_system_balance, p_new_balance, v_diff, NOW()
        );
    END IF;

    -- 5. Generate External ID
    IF p_external_id IS NULL THEN
        v_ext_id := 'RESET_' ||  p_rider_id || '_' || p_date::DATE;
    ELSE
        v_ext_id := p_external_id;
    END IF;

    -- 6. UPSERT RESET Transaction
    INSERT INTO public.wallet_ledger (
        rider_id, transaction_type, mode, amount, description, source_type, transaction_date, external_transaction_id
    ) VALUES (
        p_rider_id, 'DAY_OPENING_BALANCE', 'RESET', p_new_balance, 'Daily Wallet Update (Source)', 'IMPORT', p_date, v_ext_id
    )
    ON CONFLICT (external_transaction_id) 
    DO UPDATE SET 
        amount = EXCLUDED.amount,
        description = 'Daily Wallet Update (Source) - Corrected',
        transaction_date = EXCLUDED.transaction_date;

    RETURN jsonb_build_object('success', true, 'mismatch', v_diff <> 0, 'diff', v_diff, 'mode', 'UPSERT');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update add_wallet_transaction to skip automated imports for inactive riders
CREATE OR REPLACE FUNCTION public.add_wallet_transaction(
    p_rider_id UUID,
    p_amount NUMERIC,
    p_type TEXT,
    p_mode TEXT,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_external_id TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'MANUAL',
    p_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
    v_new_id UUID;
    v_current_balance NUMERIC;
    v_status TEXT;
BEGIN
    -- [NEW] Check Status
    SELECT status INTO v_status FROM public.riders WHERE id = p_rider_id;
    
    -- If rider is inactive, we only allow MANUAL adjustments, not automated ones.
    IF v_status = 'inactive' AND p_source = 'IMPORT' THEN
         RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Rider is inactive');
    END IF;

    -- Validate Mode
    IF p_mode NOT IN ('SET', 'RESET', 'ADD', 'SUBTRACT') THEN
          RAISE EXCEPTION 'Invalid mode. Must be SET, RESET, ADD, or SUBTRACT.';
    END IF;

    -- Insert Transaction
    INSERT INTO public.wallet_ledger (
        rider_id, transaction_type, mode, amount, description, metadata, external_transaction_id, source_type, transaction_date
    ) VALUES (
        p_rider_id, p_type, p_mode, p_amount, p_description, p_metadata, p_external_id, p_source, p_date
    ) RETURNING id INTO v_new_id;

    -- Recalculate and Update Rider Table (via existing logic)
    SELECT wallet_amount INTO v_current_balance FROM public.riders WHERE id = p_rider_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_id, 'new_balance', v_current_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
