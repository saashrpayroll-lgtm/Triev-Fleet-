-- STRICT WALLET SYSTEM IMPLEMENTATION
-- Based on User Prompt: Positive/Negative Model, Reset + Add logic.

-- 1. Ensure wallet_ledger exists with correct structure
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_id UUID NOT NULL REFERENCES public.riders(id),
    transaction_type TEXT NOT NULL, -- 'DAY_OPENING_BALANCE', 'DAILY_COLLECTION', 'MANUAL_ADJUSTMENT'
    mode TEXT NOT NULL CHECK (mode IN ('RESET', 'ADD', 'SUBTRACT')),
    amount NUMERIC NOT NULL,
    description TEXT,
    external_transaction_id TEXT, -- Unique Constraint added below
    metadata JSONB DEFAULT '{}'::jsonb,
    source_type TEXT DEFAULT 'SYSTEM',
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- 2. Add Constraints
-- Unique External Transaction ID (Prevent Duplicate Collections)
ALTER TABLE public.wallet_ledger 
DROP CONSTRAINT IF EXISTS unique_external_txn_id;

CREATE UNIQUE INDEX IF NOT EXISTS unique_external_txn_id_idx 
ON public.wallet_ledger (external_transaction_id) 
WHERE external_transaction_id IS NOT NULL;

-- 3. Mismatch Log Table (For Admin Dashboard)
CREATE TABLE IF NOT EXISTS public.wallet_mismatches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_id UUID REFERENCES public.riders(id),
    system_balance NUMERIC,
    source_balance NUMERIC,
    difference NUMERIC,
    mismatch_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- pending, resolved
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Disable Old Rent Logic
CREATE OR REPLACE FUNCTION public.add_daily_rent_charges(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
BEGIN
    -- Disabled as per new business logic (Rent is deducted in Source)
    RETURN jsonb_build_object('status', 'disabled', 'message', 'Rent calculation handled externally.');
END;
$$ LANGUAGE plpgsql;

-- 5. Core Balance Calculation Logic (Reset + Adds)
CREATE OR REPLACE FUNCTION public.calculate_rider_balance(p_rider_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_reset_amount NUMERIC := 0;
    v_reset_date TIMESTAMPTZ;
    v_adds NUMERIC := 0;
    v_subtracts NUMERIC := 0;
BEGIN
    -- A. Find Latest RESET (Day Opening Balance)
    SELECT amount, created_at, transaction_date 
    INTO v_reset_amount, v_reset_date, v_reset_date -- Use txn date as baseline
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id AND mode = 'RESET'
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;

    -- If no RESET found, assume 0 start (or sum all history if legacy)
    -- For this strict model, we assume 0 if no Reset.
    IF v_reset_date IS NULL THEN
        v_reset_amount := 0;
        v_reset_date := '2000-01-01'::TIMESTAMPTZ;
    END IF;

    -- B. Sum ADDs after Reset
    SELECT COALESCE(SUM(amount), 0) INTO v_adds
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'ADD'
      AND transaction_date > v_reset_date;

    -- C. Sum SUBTRACTs after Reset (For Manual Adjustments only)
    SELECT COALESCE(SUM(amount), 0) INTO v_subtracts
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'SUBTRACT'
      AND transaction_date > v_reset_date;

    -- D. Final Result
    RETURN v_reset_amount + v_adds - v_subtracts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger to Update Rider Master Wallet
CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    v_new_balance := public.calculate_rider_balance(NEW.rider_id);

    UPDATE public.riders 
    SET wallet_amount = v_new_balance,
        updated_at = NOW()
    WHERE id = NEW.rider_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.wallet_ledger;
CREATE TRIGGER trg_sync_wallet_balance
AFTER INSERT OR UPDATE ON public.wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION public.sync_wallet_balance();

-- 7. Bulk Update Handler (Reconcile & Reset)
-- Called by ImportUtils during Bulk Wallet Update
-- 7. Bulk Update Handler (Reconcile & Reset)
-- Called by ImportUtils during Bulk Wallet Update
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

-- Helper to force sync (if trigger fails or is bypassed)
CREATE OR REPLACE FUNCTION public.sync_wallet_balance_for_rider(p_rider_id UUID)
RETURNS VOID AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    v_new_balance := public.calculate_rider_balance(p_rider_id);
    UPDATE public.riders SET wallet_amount = v_new_balance WHERE id = p_rider_id;
END;
$$ LANGUAGE plpgsql;
