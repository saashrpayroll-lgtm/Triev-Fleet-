-- DEBUG SCRIPT: Analyze Rider Balance Calculation
-- Variable: Mobile Number
DO $$
DECLARE
    v_mobile TEXT := '919508604046'; -- Babul Singh
    v_rider_id UUID;
    v_calc_balance NUMERIC;
    v_reset_row RECORD;
    v_add_sum NUMERIC;
BEGIN
    -- 1. Get Rider ID
    SELECT id INTO v_rider_id FROM public.riders WHERE mobile_number = v_mobile LIMIT 1;
    
    RAISE NOTICE 'Debug for Rider: % (ID: %)', v_mobile, v_rider_id;

    -- 2. Check Raw Ledger
    RAISE NOTICE '--- Raw Ledger (Last 5) ---';
    FOR v_reset_row IN 
        SELECT transaction_date, mode, amount, transaction_type, created_at 
        FROM public.wallet_ledger 
        WHERE rider_id = v_rider_id 
        ORDER BY transaction_date DESC, created_at DESC 
        LIMIT 5
    LOOP
        RAISE NOTICE 'Date: %, Mode: %, Amount: %, Type: %, Created: %', 
            v_reset_row.transaction_date, v_reset_row.mode, v_reset_row.amount, v_reset_row.transaction_type, v_reset_row.created_at;
    END LOOP;

    -- 3. Run Calculation Function
    v_calc_balance := public.calculate_rider_balance(v_rider_id);
    RAISE NOTICE '--- Current Calculated Balance: % ---', v_calc_balance;

    -- 4. Manual Logic Check (Reset + Add)
    SELECT * INTO v_reset_row FROM public.wallet_ledger 
    WHERE rider_id = v_rider_id AND mode = 'RESET' 
    ORDER BY transaction_date DESC, created_at DESC LIMIT 1;

    RAISE NOTICE '--- Latest Reset Found ---';
    RAISE NOTICE 'Reset Date: %, Amount: %', v_reset_row.transaction_date, v_reset_row.amount;

    SELECT SUM(amount) INTO v_add_sum FROM public.wallet_ledger
    WHERE rider_id = v_rider_id AND mode = 'ADD' AND transaction_date > v_reset_row.transaction_date;

    RAISE NOTICE '--- Sum of ADDs after Reset ---';
    RAISE NOTICE 'Sum: %', COALESCE(v_add_sum, 0);

    RAISE NOTICE '--- Manual Calc (Reset + Add) ---';
    RAISE NOTICE 'Result: %', (v_reset_row.amount + COALESCE(v_add_sum, 0));

END $$;
