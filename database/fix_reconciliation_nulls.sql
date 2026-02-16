-- FIX: Handle NULL wallet_amount in riders table during reconciliation
-- Issue: If a rider has NULL wallet_amount, the reconciliation math (Snapshot - Current) becomes NULL, causing the update to be skipped silently.

-- 1. Update reconcile_rider_balance to use COALESCE
CREATE OR REPLACE FUNCTION public.reconcile_rider_balance(
    p_rider_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_snapshot_balance NUMERIC;
    v_snapshot_date DATE;
    v_current_ledger_balance NUMERIC;
    v_diff NUMERIC;
    v_new_txn_id UUID;
    v_action TEXT := 'NO_ACTION';
BEGIN
    -- 1. Get Latest Snapshot
    SELECT snapshot_balance, snapshot_date 
    INTO v_snapshot_balance, v_snapshot_date
    FROM public.wallet_snapshots
    WHERE rider_id = p_rider_id
    ORDER BY snapshot_date DESC, created_at DESC
    LIMIT 1;

    IF v_snapshot_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No snapshot found');
    END IF;

    -- 2. Get Current Calculated Balance (Handle NULL with 0)
    SELECT COALESCE(wallet_amount, 0) INTO v_current_ledger_balance 
    FROM public.riders 
    WHERE id = p_rider_id;

    -- 3. Calculate Difference
    v_diff := v_snapshot_balance - v_current_ledger_balance;

    IF v_diff = 0 THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already matched', 'action', 'MATCHED');
    END IF;

    -- 4. Insert Correcting Transaction
    IF v_diff > 0 THEN
        -- Snapshot is HIGHER. Need to ADD funds (Credit).
        INSERT INTO public.wallet_ledger (
            rider_id, transaction_type, mode, amount, description, source_type, transaction_date, metadata
        ) VALUES (
            p_rider_id, 
            'MANUAL_ADJUSTMENT', 
            'ADD', 
            ABS(v_diff), 
            'Auto-Reconciliation Fix (Credit)', 
            'SYSTEM', 
            NOW(), 
            jsonb_build_object('reconciled_from_snapshot', true, 'snapshot_date', v_snapshot_date)
        ) RETURNING id INTO v_new_txn_id;
        v_action := 'CREDITED';
    
    ELSIF v_diff < 0 THEN
        -- Snapshot is LOWER. Need to SUBTRACT funds (Debit).
        INSERT INTO public.wallet_ledger (
            rider_id, transaction_type, mode, amount, description, source_type, transaction_date, metadata
        ) VALUES (
            p_rider_id, 
            'MANUAL_ADJUSTMENT', 
            'SUBTRACT', 
            ABS(v_diff), 
            'Auto-Reconciliation Fix (Debit)', 
            'SYSTEM', 
            NOW(), 
            jsonb_build_object('reconciled_from_snapshot', true, 'snapshot_date', v_snapshot_date)
        ) RETURNING id INTO v_new_txn_id;
        v_action := 'DEBITED';
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'rider_id', p_rider_id,
        'old_balance', v_current_ledger_balance,
        'new_balance', v_snapshot_balance,
        'diff', v_diff,
        'action', v_action,
        'txn_id', v_new_txn_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update process_wallet_snapshot to use COALESCE
CREATE OR REPLACE FUNCTION public.process_wallet_snapshot(
    p_rider_id UUID,
    p_snapshot_balance NUMERIC,
    p_snapshot_date DATE,
    p_source_type TEXT -- 'RIDER_IMPORT' or 'WALLET_UPDATE'
)
RETURNS JSONB AS $$
DECLARE
    v_current_ledger_balance NUMERIC;
    v_diff NUMERIC;
    v_daily_rent NUMERIC;
    v_action_taken TEXT := 'SNAPSHOT_ONLY';
    v_new_txn_id UUID;
BEGIN
    -- 1. Insert Snapshot
    INSERT INTO public.wallet_snapshots (rider_id, snapshot_balance, snapshot_date, source_type)
    VALUES (p_rider_id, p_snapshot_balance, p_snapshot_date, p_source_type);

    -- 2. Calculate Difference
    SELECT COALESCE(wallet_amount, 0) INTO v_current_ledger_balance FROM public.riders WHERE id = p_rider_id;
    
    v_diff := p_snapshot_balance - v_current_ledger_balance;

    -- Fetch Daily Rent for logic
    SELECT daily_rent_amount INTO v_daily_rent FROM public.rent_master WHERE rider_id = p_rider_id;

    IF v_diff = 0 THEN
        v_action_taken := 'MATCHED';
        
    ELSIF v_diff < 0 THEN
        -- Check for Missed Rent
        IF v_daily_rent IS NOT NULL AND ABS(ABS(v_diff) - v_daily_rent) < 1 THEN
            INSERT INTO public.wallet_ledger (
                rider_id, transaction_type, mode, amount, description, source_type, transaction_date, metadata
            ) VALUES (
                p_rider_id, 'SYSTEM_RENT_CHARGE', 'SUBTRACT', v_daily_rent, 
                'Auto-Reconciled Rent from Snapshot', 'IMPORT', p_snapshot_date, 
                jsonb_build_object('auto_reconciled', true, 'snapshot_date', p_snapshot_date)
            ) RETURNING id INTO v_new_txn_id;
            v_action_taken := 'AUTO_ADDED_RENT';
        ELSE
            -- Unknown Debit.
            v_action_taken := 'MISMATCH_LOWER';
        END IF;

    ELSIF v_diff > 0 THEN
        v_action_taken := 'MISMATCH_HIGHER';
    END IF;

    RETURN jsonb_build_object(
        'rider_id', p_rider_id,
        'system_balance', v_current_ledger_balance,
        'snapshot_balance', p_snapshot_balance,
        'diff', v_diff,
        'action', v_action_taken
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
