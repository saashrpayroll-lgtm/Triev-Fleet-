
-- 3. One-Click Reconciliation Fix
-- This function is called by Admin to force-reconcile a rider's balance with their latest Snapshot.
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

    -- 2. Get Current Calculated Balance
    SELECT wallet_amount INTO v_current_ledger_balance 
    FROM public.riders 
    WHERE id = p_rider_id;

    -- 3. Calculate Difference
    -- Standard Model: Positive = Credit, Negative = Debit
    -- Diff = Snapshot (Target) - System (Current)
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
