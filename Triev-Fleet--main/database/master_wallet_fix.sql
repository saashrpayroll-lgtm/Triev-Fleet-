-- MASTER WALLET FIX SCRIPT
-- 1. Fixes NULL/Zero balance silent failures.
-- 2. Prevents Double Counting by ensuring Single Trigger.
-- 3. Updates logic to correctly handle 'New Rider' scenarios.

-- PART 1: RECALCULATION LOGIC (The Core Engine)
CREATE OR REPLACE FUNCTION public.recalculate_rider_wallet_balance(target_rider_id UUID)
RETURNS VOID AS $$
DECLARE
    latest_set_record RECORD;
    total_add NUMERIC := 0;
    total_subtract NUMERIC := 0;
    base_balance NUMERIC := 0;
    base_time TIMESTAMP WITH TIME ZONE := '-infinity';
    final_balance NUMERIC := 0;
BEGIN
    -- A. Find the latest 'SET' transaction (Baseline)
    SELECT * INTO latest_set_record
    FROM public.wallet_ledger
    WHERE rider_id = target_rider_id AND mode = 'SET'
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        base_balance := COALESCE(latest_set_record.amount, 0);
        base_time := latest_set_record.created_at;
    END IF;

    -- B. Sum ADDs after baseline (Handle NULLs)
    SELECT COALESCE(SUM(amount), 0) INTO total_add
    FROM public.wallet_ledger
    WHERE rider_id = target_rider_id 
      AND mode = 'ADD' 
      AND created_at > base_time;

    -- C. Sum SUBTRACTs after baseline (Handle NULLs)
    SELECT COALESCE(SUM(amount), 0) INTO total_subtract
    FROM public.wallet_ledger
    WHERE rider_id = target_rider_id 
      AND mode = 'SUBTRACT' 
      AND created_at > base_time;

    -- D. Calculate Final
    final_balance := base_balance + total_add - total_subtract;

    -- E. Update Cache in Riders Table
    UPDATE public.riders
    SET wallet_amount = final_balance
    WHERE id = target_rider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- PART 2: TRIGGER MANAGEMENT (Prevent Doubles)
-- Drop ALL potential duplicate triggers to be safe
DROP TRIGGER IF EXISTS trg_update_wallet_balance ON public.wallet_ledger;
DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON public.wallet_ledger;
DROP TRIGGER IF EXISTS on_wallet_ledger_change ON public.wallet_ledger;

-- Recreate Single Canonical Trigger
CREATE OR REPLACE FUNCTION public.trigger_update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.recalculate_rider_wallet_balance(OLD.rider_id);
    ELSE
        PERFORM public.recalculate_rider_wallet_balance(NEW.rider_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_wallet_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_wallet_balance();


-- PART 3: RECONCILIATION LOGIC (Fixing Zero/Null Issue)
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

    -- 5. Return updated status
    -- The trigger on wallet_ledger will have fired by now, updating riders table.
    -- We select fresh balance to confirm.
    SELECT COALESCE(wallet_amount, 0) INTO v_current_ledger_balance 
    FROM public.riders 
    WHERE id = p_rider_id;

    RETURN jsonb_build_object(
        'success', true, 
        'rider_id', p_rider_id,
        'old_balance', v_current_ledger_balance - v_diff, -- approx
        'new_balance', v_current_ledger_balance,
        'diff', v_diff,
        'action', v_action,
        'txn_id', v_new_txn_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- PART 4: FORCE RECALCULATE FOR ALL NULL/ZERO WALLETS
-- Run this once to fix any existing stale data
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.riders WHERE wallet_amount IS NULL OR wallet_amount = 0 LOOP
        PERFORM public.recalculate_rider_wallet_balance(r.id);
    END LOOP;
END $$;
