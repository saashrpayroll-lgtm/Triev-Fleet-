-- CLEANUP SCRIPT: Run this to fix "Function signature mismatch" AND "Constraint" issues.

-- 0. Ensure Constraint/Index exists properly for ON CONFLICT
-- Drop potential partial indexes that cause mismatch
DROP INDEX IF EXISTS public.unique_external_txn_id_idx;
-- Create standard unique index (Postgres allows multiple NULLs, so this is safe and works with ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS unique_external_txn_id_idx 
ON public.wallet_ledger (external_transaction_id);

-- 0.1 Ensure 'RESET' is allowed in mode constraint
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_mode_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_mode_check 
CHECK (mode IN ('RESET', 'ADD', 'SUBTRACT', 'SET')); 

-- 0.2 Ensure 'DAY_OPENING_BALANCE' is allowed in transaction_type constraint
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_transaction_type_check 
CHECK (transaction_type IN ('DAY_OPENING_BALANCE', 'DAILY_COLLECTION', 'MANUAL_ADJUSTMENT', 'RENT_COLLECTION', 'SYSTEM_IMPORT', 'BULK_IMPORT'));

-- 1. Drop ALL versions of handle_daily_wallet_update
DROP FUNCTION IF EXISTS public.handle_daily_wallet_update(UUID, NUMERIC, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.handle_daily_wallet_update(UUID, NUMERIC, TIMESTAMPTZ, TEXT);

-- 2. Drop Helper Function to ensure clean recreate
DROP FUNCTION IF EXISTS public.sync_wallet_balance_for_rider(UUID);

-- 3. Re-Create Helper Function
CREATE OR REPLACE FUNCTION public.sync_wallet_balance_for_rider(p_rider_id UUID)
RETURNS VOID AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    v_new_balance := public.calculate_rider_balance(p_rider_id);
    UPDATE public.riders SET wallet_amount = v_new_balance WHERE id = p_rider_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-Create Main Function (Strict + UPSERT)
CREATE OR REPLACE FUNCTION public.handle_daily_wallet_update(
    p_rider_id UUID,
    p_new_balance NUMERIC,
    p_date TIMESTAMPTZ,
    p_external_id TEXT DEFAULT NULL -- Optional, but recommended for stability
)
RETURNS JSONB AS $$
DECLARE
    v_current_system_balance NUMERIC;
    v_diff NUMERIC;
    v_action TEXT;
    v_ext_id TEXT;
BEGIN
    -- 1. Get Current System Balance (Closing of Previous Day)
    v_current_system_balance := public.calculate_rider_balance(p_rider_id);
    
    -- 2. Compare
    v_diff := p_new_balance - v_current_system_balance;

    -- 3. Log Mismatch if exists
    IF v_diff <> 0 THEN
        INSERT INTO public.wallet_mismatches (
            rider_id, system_balance, source_balance, difference, mismatch_date
        ) VALUES (
            p_rider_id, v_current_system_balance, p_new_balance, v_diff, NOW()
        );
    END IF;

    -- 4. Generate External ID if not provided (Fallback to old logic)
    IF p_external_id IS NULL THEN
        v_ext_id := 'RESET_' ||  p_rider_id || '_' || p_date::DATE;
    ELSE
        v_ext_id := p_external_id;
    END IF;

    -- 5. UPSERT (Insert or Update on Conflict)
    -- This handles both New Day (Insert) and Correction (Update) robustly.
    
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
        transaction_date = EXCLUDED.transaction_date; -- Update time to match latest upload

    -- 6. FORCE BALANCE SYNC
    PERFORM public.sync_wallet_balance_for_rider(p_rider_id);

    RETURN jsonb_build_object(
        'success', true, 
        'mismatch', v_diff <> 0, 
        'diff', v_diff,
        'mode', 'UPSERT'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
