-- DEBUG SCRIPT: Diagnosis for Wallet Logic
-- Run this in Supabase SQL Editor to check the health of the wallet system.

-- 1. Check for Duplicate Triggers on wallet_ledger
SELECT event_object_table, trigger_name, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'wallet_ledger';

-- 2. Debug Function: Analyze a specific Rider's Wallet
-- Usage: SELECT analyze_rider_wallet('8929829059'); -- Pass Mobile or TrievID
CREATE OR REPLACE FUNCTION public.analyze_rider_wallet(p_identifier TEXT)
RETURNS JSONB AS $$
DECLARE
    v_rider_id UUID;
    v_rider_record RECORD;
    v_ledger_sum NUMERIC;
    v_snapshot_record RECORD;
    v_set_record RECORD;
    v_base_balance NUMERIC := 0;
    v_adds NUMERIC := 0;
    v_subs NUMERIC := 0;
    v_calc_balance NUMERIC;
BEGIN
    -- Find Rider
    SELECT * INTO v_rider_record 
    FROM public.riders 
    WHERE mobile_number = p_identifier OR triev_id = p_identifier
    LIMIT 1;

    IF v_rider_record IS NULL THEN
        RETURN jsonb_build_object('error', 'Rider not found for identifier: ' || p_identifier);
    END IF;
    v_rider_id := v_rider_record.id;

    -- Get Latest Snapshot
    SELECT * INTO v_snapshot_record 
    FROM public.wallet_snapshots 
    WHERE rider_id = v_rider_id 
    ORDER BY snapshot_date DESC, created_at DESC 
    LIMIT 1;

    -- Calculate Balance via Ledger Logic (Re-implementation of recalculate)
    -- A. Base (SET)
    SELECT * INTO v_set_record FROM public.wallet_ledger 
    WHERE rider_id = v_rider_id AND mode = 'SET' 
    ORDER BY created_at DESC LIMIT 1;

    IF FOUND THEN
        v_base_balance := v_set_record.amount;
    END IF;

    -- B. Adds
    SELECT COALESCE(SUM(amount), 0) INTO v_adds 
    FROM public.wallet_ledger 
    WHERE rider_id = v_rider_id AND mode = 'ADD' 
    AND (v_set_record IS NULL OR created_at > v_set_record.created_at);

    -- C. Subs
    SELECT COALESCE(SUM(amount), 0) INTO v_subs 
    FROM public.wallet_ledger 
    WHERE rider_id = v_rider_id AND mode = 'SUBTRACT' 
    AND (v_set_record IS NULL OR created_at > v_set_record.created_at);

    v_calc_balance := v_base_balance + v_adds - v_subs;

    RETURN jsonb_build_object(
        'rider_name', v_rider_record.rider_name,
        'rider_status', v_rider_record.status,
        'current_db_balance', v_rider_record.wallet_amount,
        'calculated_balance', v_calc_balance,
        'is_match', (v_rider_record.wallet_amount = v_calc_balance),
        'base_balance', v_base_balance,
        'total_adds', v_adds,
        'total_subtracts', v_subs,
        'latest_snapshot', v_snapshot_record.snapshot_balance,
        'latest_snapshot_diff', (v_snapshot_record.snapshot_balance - v_rider_record.wallet_amount)
    );
END;
$$ LANGUAGE plpgsql;

-- 3. Run Analysis on a "Zero Balance" rider (Replace '1234567890' with actual mobile from your sheet)
-- SELECT analyze_rider_wallet('YOUR_RIDER_MOBILE');
