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
                    'ADD', -- Increases Debt
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
    
    -- Diff = New Snapshot (External Truth) - System Balance (Internal Truth)
    -- If Snapshot says 500 (Debt) and System says 400 (Debt) -> Diff = +100 (Debt increased).
    -- This implies a Charge was missed (Rent?).
    
    -- If Snapshot says 300 (Debt) and System says 400 (Debt) -> Diff = -100 (Debt decreased).
    -- This implies a Payment was missed (Collection?).
    
    v_diff := p_snapshot_balance - v_current_ledger_balance;

    -- Fetch Daily Rent for logic
    SELECT daily_rent_amount INTO v_daily_rent FROM public.rent_master WHERE rider_id = p_rider_id;

    IF v_diff = 0 THEN
        v_action_taken := 'MATCHED';
        
    ELSIF v_diff > 0 THEN
        -- Debt Increased. 
        -- Case A: Missed Rent?
        IF v_daily_rent IS NOT NULL AND ABS(v_diff - v_daily_rent) < 1 THEN
            -- It matches daily rent amount. Auto-insert Rent.
            INSERT INTO public.wallet_ledger (
                rider_id, transaction_type, mode, amount, description, source_type, transaction_date, metadata
            ) VALUES (
                p_rider_id, 'SYSTEM_RENT_CHARGE', 'ADD', v_daily_rent, 
                'Auto-Reconciled Rent from Snapshot', 'IMPORT', p_snapshot_date, 
                jsonb_build_object('auto_reconciled', true, 'snapshot_date', p_snapshot_date)
            ) RETURNING id INTO v_new_txn_id;
            v_action_taken := 'AUTO_ADDED_RENT';
        ELSE
            -- Unknown Debt Increase. Flag it?
            -- For now, just leave it as discrepancy for Admin to see.
            v_action_taken := 'MISMATCH_HIGHER';
        END IF;

    ELSIF v_diff < 0 THEN
        -- Debt Decreased.
        -- Case B: Missed Collection?
        -- We treat the Diff magnitude as the Collection Amount.
        -- We insert a 'DAILY_COLLECTION' (SUBTRACT).
        
        -- STRICT RULE: "Only transactions with valid transaction_id... should be considered recharge"
        -- Since this is coming from a "Wallet Update" file which usually has just balance, 
        -- we might NOT have a txn id.
        -- So we CANNOT auto-insert collection without a Txn ID usually.
        -- But prompt said: "IF difference matches Collection Import Amount -> Insert".
        -- Here we don't have "Collection Import Amount", we just have Balance.
        
        -- Prompt 3: "IF difference matches collection import amount... Insert"
        -- Prompt 5B: "Wallet Update... Trigger difference engine... Never overwrite".
        
        -- Attempt Auto-Reconcile if it looks like a clean collection?
        -- Risk: Double counting if safe-guards fail.
        -- Safe Bet: Record snapshot, let Admin see Mismatch.
        
        v_action_taken := 'MISMATCH_LOWER';
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
