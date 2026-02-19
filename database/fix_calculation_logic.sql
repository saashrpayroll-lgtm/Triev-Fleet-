-- FIX SCRIPT: Run this to fix the "Balance Calculation" issue.

-- 1. Redefine the Calculation Logic (Fixing variable assignment)
CREATE OR REPLACE FUNCTION public.calculate_rider_balance(p_rider_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_reset_amount NUMERIC := 0;
    v_reset_date TIMESTAMPTZ;
    v_adds NUMERIC := 0;
    v_subtracts NUMERIC := 0;
BEGIN
    -- A. Find Latest RESET (Day Opening Balance)
    -- Explicitly select values into distinct variables to avoid confusion
    SELECT amount, transaction_date 
    INTO v_reset_amount, v_reset_date
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id AND mode = 'RESET'
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;

    -- If no RESET found, assume 0
    IF v_reset_date IS NULL THEN
        v_reset_amount := 0;
        v_reset_date := '2000-01-01'::TIMESTAMPTZ;
    END IF;

    -- B. Sum ADDs after Reset (Collections, etc.)
    SELECT COALESCE(SUM(amount), 0) INTO v_adds
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'ADD'
      -- Use >= to include transactions that happened at the exact same millisecond (unlikely but safe)
      -- logic: If Collection is AFTER or AT SAME time as Reset, we count it. 
      -- But usually Reset is "Start of Day" (Midnight) or "Now" (Shift Start).
      AND transaction_date >= v_reset_date
      AND id NOT IN (
          SELECT id FROM public.wallet_ledger 
          WHERE rider_id = p_rider_id AND mode = 'RESET' ORDER BY transaction_date DESC LIMIT 1
      ); -- Exclude the Reset row itself if it somehow matched the time query

    -- C. Sum SUBTRACTs after Reset
    SELECT COALESCE(SUM(amount), 0) INTO v_subtracts
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'SUBTRACT'
      AND transaction_date >= v_reset_date;

    -- D. Final Result
    RETURN v_reset_amount + v_adds - v_subtracts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Force Sync All Riders (To correct the 750 -> 320)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.riders LOOP
        PERFORM public.sync_wallet_balance_for_rider(r.id);
    END LOOP;
END $$;
