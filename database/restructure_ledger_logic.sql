-- Phase 2: Ledger Backend Logic

-- 1. Daily Rent Charge Function
CREATE OR REPLACE FUNCTION public.add_daily_rent_charges(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
    v_success_count INT := 0;
    v_skip_count INT := 0;
    v_error_count INT := 0;
    r RECORD;
BEGIN
    FOR r IN 
        SELECT rm.rider_id, rm.daily_rent_amount 
        FROM public.rent_master rm
        JOIN public.riders rider ON rm.rider_id = rider.id
        WHERE rider.status = 'active' -- Only charge active riders
    LOOP
        BEGIN
            -- Check if rent already charged for this date
            PERFORM 1 FROM public.wallet_ledger 
            WHERE rider_id = r.rider_id 
              AND transaction_type = 'SYSTEM_RENT_CHARGE'
              AND (metadata->>'rent_date')::DATE = p_date;

            IF NOT FOUND THEN
                INSERT INTO public.wallet_ledger (
                    rider_id,
                    transaction_type,
                    mode,
                    amount,
                    description,
                    source_type,
                    transaction_date,
                    metadata,
                    created_by
                ) VALUES (
                    r.rider_id,
                    'SYSTEM_RENT_CHARGE',
                    'SUBTRACT', -- Decreases Balance (Debit)
                    r.daily_rent_amount,
                    'Daily Rent Charge for ' || TO_CHAR(p_date, 'YYYY-MM-DD'),
                    'SYSTEM',
                    p_date,
                    jsonb_build_object('rent_date', p_date),
                    NULL -- System generated
                );
                v_success_count := v_success_count + 1;
            ELSE
                v_skip_count := v_skip_count + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', v_success_count, 
        'skipped', v_skip_count, 
        'errors', v_error_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Snapshot Reconciliation Logic
-- This function is called when a Wallet Update Import happens.
-- It records the snapshot and attempts to reconcile the difference.
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

    -- 2. If source is 'RIDER_IMPORT' (Initial Load), we might want to SET the balance if no ledger exists?
    -- But strict rules say "Never SET". 
    -- However, for migration we might need an Opening Balance.
    -- Assuming migration is done, we focus on updates.

    -- 3. Calculate Difference
    -- Get current calculated balance (Debt)
    -- We need to know what the balance WAS at p_snapshot_date? 
    -- Complex to time-travel. Let's compare with CURRENT system balance for simplicity, 
    -- assuming snapshot is recent.
    
    -- Recalculate wrapper to ensure riders table is up to date?
    -- Or just trust riders.wallet_amount?
    SELECT wallet_amount INTO v_current_ledger_balance FROM public.riders WHERE id = p_rider_id;
    
    -- Standard Wallet Model: Positive = Credit, Negative = Debit
    -- Diff = Snapshot (True) - System (Calculated)
    v_diff := p_snapshot_balance - v_current_ledger_balance;

    -- Fetch Daily Rent for logic
    SELECT daily_rent_amount INTO v_daily_rent FROM public.rent_master WHERE rider_id = p_rider_id;

    IF v_diff = 0 THEN
        v_action_taken := 'MATCHED';
        
    ELSIF v_diff < 0 THEN
        -- Snapshot is LOWER than System.
        -- Example: System says 500, Snapshot says 200. Diff = -300.
        -- Means we missed a DEBIT (SUBTRACT transaction) like Rent.
        
        -- Case A: Missed Rent?
        -- Check if Diff matches daily rent magnitude
        IF v_daily_rent IS NOT NULL AND ABS(ABS(v_diff) - v_daily_rent) < 1 THEN
            -- It matches daily rent amount. Auto-insert Rent (SUBTRACT).
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
        -- Snapshot is HIGHER than System.
        -- Example: System says 200, Snapshot says 500. Diff = +300.
        -- Means we missed a CREDIT (ADD transaction) like Collection/Recharge.
        
        -- Case B: Missed Collection?
        -- Cannot auto-insert without Transaction ID.
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
