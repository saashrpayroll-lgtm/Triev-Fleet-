-- 3. One-Click Reconciliation Fix (SMART VERSION)
-- Reconciles rider's balance with (Snapshot + Approved Transactions since Snapshot).
-- Avoids reverting valid collections when "Fix" is clicked.

CREATE OR REPLACE FUNCTION public.reconcile_rider_balance(
    p_rider_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_snapshot_balance NUMERIC;
    v_snapshot_date DATE;
    v_snapshot_created_at TIMESTAMPTZ;
    v_current_ledger_balance NUMERIC;
    v_movement_since_snapshot NUMERIC := 0;
    v_target_balance NUMERIC;
    v_diff NUMERIC;
    v_new_txn_id UUID;
    v_action TEXT := 'NO_ACTION';
BEGIN
    -- 1. Get Latest Snapshot details
    SELECT snapshot_balance, snapshot_date, created_at
    INTO v_snapshot_balance, v_snapshot_date, v_snapshot_created_at
    FROM public.wallet_snapshots
    WHERE rider_id = p_rider_id
    ORDER BY snapshot_date DESC, created_at DESC
    LIMIT 1;

    IF v_snapshot_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No snapshot found');
    END IF;

    -- 2. Calculate Approved Movements Since Snapshot
    -- (This logic must match view_reconciliation_status)
    SELECT COALESCE(SUM(
        CASE 
            WHEN mode = 'ADD' THEN amount 
            WHEN mode = 'SUBTRACT' THEN -amount 
            ELSE 0 
        END
    ), 0)
    INTO v_movement_since_snapshot
    FROM public.wallet_ledger 
    WHERE rider_id = p_rider_id 
      AND created_at > v_snapshot_created_at;

    -- 3. Determine Target Balance
    v_target_balance := v_snapshot_balance + v_movement_since_snapshot;

    -- 4. Get Current System Balance
    SELECT COALESCE(wallet_amount, 0) INTO v_current_ledger_balance 
    FROM public.riders 
    WHERE id = p_rider_id;

    -- 5. Calculate Difference
    -- Diff = Target - System
    v_diff := v_target_balance - v_current_ledger_balance;

    IF v_diff = 0 THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already matched', 'action', 'MATCHED');
    END IF;

    -- 6. Insert Correcting Transaction
    -- This transaction bridges the gap between System and (Snapshot + Movements)
    IF v_diff > 0 THEN
        -- Target is HIGHER. Need to ADD funds (Credit).
        INSERT INTO public.wallet_ledger (
            rider_id, transaction_type, mode, amount, description, source_type, transaction_date, metadata
        ) VALUES (
            p_rider_id, 
            'MANUAL_ADJUSTMENT', 
            'ADD', 
            ABS(v_diff), 
            'Smart Reconciliation Fix (Credit)', 
            'SYSTEM', 
            NOW(), 
            jsonb_build_object(
                'reconciled_from_snapshot', true, 
                'snapshot_date', v_snapshot_date,
                'adjusts_for_movements', v_movement_since_snapshot
            )
        ) RETURNING id INTO v_new_txn_id;
        v_action := 'CREDITED';
    
    ELSIF v_diff < 0 THEN
        -- Target is LOWER. Need to SUBTRACT funds (Debit).
        INSERT INTO public.wallet_ledger (
            rider_id, transaction_type, mode, amount, description, source_type, transaction_date, metadata
        ) VALUES (
            p_rider_id, 
            'MANUAL_ADJUSTMENT', 
            'SUBTRACT', 
            ABS(v_diff), 
            'Smart Reconciliation Fix (Debit)', 
            'SYSTEM', 
            NOW(), 
            jsonb_build_object(
                'reconciled_from_snapshot', true, 
                'snapshot_date', v_snapshot_date,
                'adjusts_for_movements', v_movement_since_snapshot
            )
        ) RETURNING id INTO v_new_txn_id;
        v_action := 'DEBITED';
    END IF;

    -- 7. Return Result
    RETURN jsonb_build_object(
        'success', true, 
        'rider_id', p_rider_id,
        'old_balance', v_current_ledger_balance,
        'new_balance', v_target_balance,
        'snapshot_base', v_snapshot_balance, 
        'movements_since', v_movement_since_snapshot,
        'diff', v_diff,
        'action', v_action,
        'txn_id', v_new_txn_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
