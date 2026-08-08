-- DECOUPLED WALLET LOGIC
-- Objective: Separate Wallet Balance (Bulk Update) from TL Performance (Rent Collection).
-- 1. Balance = Latest RESET (Bulk Update) + SUM of MANUAL_ADJUSTMENT (Optional fixes).
-- 2. DAILY_COLLECTION (Rent) is 100% IGNORED for balance calculation.
-- 3. TL Performance continues to work because it listens to the 'daily_collections' table.

-- 1. Redefine Balance Calculation
CREATE OR REPLACE FUNCTION public.calculate_rider_balance(p_rider_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_reset_amount NUMERIC := 0;
    v_reset_date TIMESTAMPTZ;
    v_adds NUMERIC := 0;
    v_subtracts NUMERIC := 0;
BEGIN
    -- A. Find Latest RESET (Day Opening Balance)
    SELECT amount, transaction_date 
    INTO v_reset_amount, v_reset_date
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id AND mode = 'RESET'
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;

    -- If no RESET found, fallback to 0 (Start of time)
    IF v_reset_date IS NULL THEN
        v_reset_date := '2000-01-01'::TIMESTAMPTZ;
        v_reset_amount := 0;
    END IF;

    -- B. Sum ADDs after Reset (IGNORE DAILY_COLLECTION)
    SELECT COALESCE(SUM(amount), 0) INTO v_adds
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'ADD' 
      AND transaction_type != 'DAILY_COLLECTION' -- THE KEY FIX
      AND transaction_date > v_reset_date;

    -- C. Sum SUBTRACTs after Reset (IGNORE DAILY_COLLECTION)
    SELECT COALESCE(SUM(amount), 0) INTO v_subtracts
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'SUBTRACT' 
      AND transaction_type != 'DAILY_COLLECTION' -- THE KEY FIX
      AND transaction_date > v_reset_date;

    -- D. Final Result (Bulk Update + Any Manual Fixes by Admin)
    RETURN v_reset_amount + v_adds - v_subtracts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Force Sync All Riders (To apply this new logic immediately)
DO $$
DECLARE
    r RECORD;
    v_count INT := 0;
BEGIN
    RAISE NOTICE 'Starting Bulk Decoupled Wallet Sync...';

    FOR r IN SELECT id, mobile_number FROM public.riders LOOP
        PERFORM public.sync_wallet_balance_for_rider(r.id);
        v_count := v_count + 1;
    END LOOP;

    RAISE NOTICE 'Successfully applied Decoupled Logic to % riders.', v_count;
END $$;
