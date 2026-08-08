-- =========================================================================================
-- FIX: REDEFINE WALLET CALCULATION TO EXCLUDE COLLECTIONS
-- =========================================================================================
-- Objective: Ensure 'wallet_amount' reflects only the Opening Balance and manual fixes.
-- Rental collection / Daily collections are tracked separately and do not add to wallet.
-- =========================================================================================

BEGIN;

-- 1. REDEFINE CALCULATION FUNCTION
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

    -- If no RESET found, assume 0 start
    IF v_reset_date IS NULL THEN
        v_reset_amount := 0;
        v_reset_date := '1970-01-01'::TIMESTAMPTZ;
    END IF;

    -- B. Sum ADDs after Reset (EXCLUDING Collections)
    -- We filter out DAILY_COLLECTION, RENT_COLLECTION, and FTD_COLLECTION
    -- so that these automated collections do not "pay off" the rider's debt
    -- if they are meant to be kept separate.
    SELECT COALESCE(SUM(amount), 0) INTO v_adds
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'ADD'
      AND transaction_date > v_reset_date
      AND transaction_type NOT IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION');

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

-- 2. FORCE RE-SYNC FOR ALL RIDERS
-- This will update the 'wallet_amount' field in the riders table immediately.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.riders LOOP
        UPDATE public.riders 
        SET wallet_amount = public.calculate_rider_balance(r.id),
            updated_at = NOW()
        WHERE id = r.id;
    END LOOP;
END $$;

COMMIT;
