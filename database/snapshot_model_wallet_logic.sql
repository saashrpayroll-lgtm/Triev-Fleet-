-- SNAPSHOT AUTHORITATIVE MODEL SCRIPT
-- Objective: Make the 12:00 AM Bulk Update the SINGLE source of truth.
-- 1. Balance = Latest 'RESET' transaction.
-- 2. History (ADD/SUBTRACT) is ignored for balance calculation.
-- 3. No Mismatches - The uploaded file is the Truth.

-- 1. Drop existing functions to allow signature changes if needed
DROP FUNCTION IF EXISTS public.handle_daily_wallet_update(UUID, NUMERIC, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.sync_wallet_balance_for_rider(UUID);
DROP FUNCTION IF EXISTS public.calculate_rider_balance(UUID);

-- 2. Redefine Calculation Logic: SNAPSHOT ONLY
CREATE OR REPLACE FUNCTION public.calculate_rider_balance(p_rider_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    -- Select STRICTLY the latest RESET transaction.
    -- We ignore all ADD/SUBTRACT rows for the actual balance.
    SELECT amount INTO v_balance
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id AND mode = 'RESET'
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;

    -- If no snapshot exists, return 0 (New Rider) or handle as needed.
    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Helper to Sync Riders Table
CREATE OR REPLACE FUNCTION public.sync_wallet_balance_for_rider(p_rider_id UUID)
RETURNS VOID AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    v_new_balance := public.calculate_rider_balance(p_rider_id);
    UPDATE public.riders SET wallet_amount = v_new_balance WHERE id = p_rider_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Main Import Logic: PURE UPSERT (No Mismatch/Diff Logic)
CREATE OR REPLACE FUNCTION public.handle_daily_wallet_update(
    p_rider_id UUID,
    p_new_balance NUMERIC,
    p_date TIMESTAMPTZ,
    p_external_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_ext_id TEXT;
BEGIN
    -- Generate External ID if not provided (RESET_RiderID_Date)
    IF p_external_id IS NULL THEN
        v_ext_id := 'RESET_' ||  p_rider_id || '_' || p_date::DATE;
    ELSE
        v_ext_id := p_external_id;
    END IF;

    -- UPSERT: Insert or Update if already exists for this day
    -- This sets the "Source of Truth" for this day.
    INSERT INTO public.wallet_ledger (
        rider_id, transaction_type, mode, amount, description, source_type, transaction_date, external_transaction_id
    ) VALUES (
        p_rider_id, 
        'DAY_OPENING_BALANCE', 
        'RESET', 
        p_new_balance, 
        'Daily Wallet Update (Source)', 
        'IMPORT', 
        p_date,
        v_ext_id
    )
    ON CONFLICT (external_transaction_id) 
    DO UPDATE SET 
        amount = EXCLUDED.amount,
        description = 'Daily Wallet Update (Source) - Corrected',
        metadata = jsonb_build_object('updated_at', NOW()),
        transaction_date = EXCLUDED.transaction_date;

    -- Force Sync Rider Balance to this new Snapshot
    PERFORM public.sync_wallet_balance_for_rider(p_rider_id);

    -- Return Success (No mismatch info needed because we just overwrote it)
    RETURN jsonb_build_object(
        'success', true, 
        'mode', 'UPSERT',
        'new_balance', p_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Force Sync All Riders to apply the new "Snapshot Only" Logic immediately
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.riders LOOP
        PERFORM public.sync_wallet_balance_for_rider(r.id);
    END LOOP;
END $$;
