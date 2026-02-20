-- FORCE FIX: Wallet Calculation Logic
-- Issue Diagnostic: The system was summing all history (Old + Reset + Collection) = 1170, instead of (Reset + Collection) = 410.
-- This implies the "Find Latest Reset" query was returning NULL or failing to set the cut-off date.

-- 1. Redefine Function with simplified logic
CREATE OR REPLACE FUNCTION public.calculate_rider_balance(p_rider_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_reset_amount NUMERIC := 0;
    v_reset_date TIMESTAMPTZ;
    v_adds NUMERIC := 0;
    v_subtracts NUMERIC := 0;
BEGIN
    -- A. Find Latest RESET (Day Opening Balance)
    -- Fixed: Clean SELECT INTO with no variable shadowing
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

    -- B. Sum ADDs after Reset
    SELECT COALESCE(SUM(amount), 0) INTO v_adds
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'ADD' 
      AND transaction_date > v_reset_date;

    -- C. Sum SUBTRACTs after Reset
    SELECT COALESCE(SUM(amount), 0) INTO v_subtracts
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'SUBTRACT' 
      AND transaction_date > v_reset_date;

    -- D. Final Result
    RETURN v_reset_amount + v_adds - v_subtracts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Force Recalculate for Babul Singh (and return result for verification)
DO $$
DECLARE
    v_mobile TEXT := '919508604046';
    v_rider_id UUID;
    v_new_bal NUMERIC;
BEGIN
    SELECT id INTO v_rider_id FROM public.riders WHERE mobile_number = v_mobile;
    
    -- Recalculate
    PERFORM public.sync_wallet_balance_for_rider(v_rider_id);
    
    -- Verify
    SELECT wallet_amount INTO v_new_bal FROM public.riders WHERE id = v_rider_id;
    
    RAISE NOTICE 'Fixed Balance for %: %', v_mobile, v_new_bal;
END $$;
