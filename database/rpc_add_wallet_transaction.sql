-- RPC Function to safely add a wallet transaction
CREATE OR REPLACE FUNCTION public.add_wallet_transaction(
    p_rider_id UUID,
    p_amount NUMERIC,
    p_type TEXT, -- 'SYSTEM_IMPORT', 'MANUAL_ADJUSTMENT', 'DAILY_COLLECTION'
    p_mode TEXT, -- 'SET', 'ADD', 'SUBTRACT'
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_created_by UUID DEFAULT auth.uid()
)
RETURNS JSONB AS $$
DECLARE
    v_new_id UUID;
    v_current_balance NUMERIC;
BEGIN
    -- 1. Validation
    IF p_amount < 0 THEN
        RAISE EXCEPTION 'Amount must be positive. Use mode SUBTRACT for deductions.';
    END IF;

    IF p_mode NOT IN ('SET', 'ADD', 'SUBTRACT') THEN
        RAISE EXCEPTION 'Invalid mode. Must be SET, ADD, or SUBTRACT.';
    END IF;

    IF p_type NOT IN ('SYSTEM_IMPORT', 'MANUAL_ADJUSTMENT', 'DAILY_COLLECTION') THEN
        RAISE EXCEPTION 'Invalid transaction type.';
    END IF;

    -- 2. Insert into Ledger
    INSERT INTO public.wallet_ledger (
        rider_id,
        transaction_type,
        mode,
        amount,
        description,
        metadata,
        created_by
    ) VALUES (
        p_rider_id,
        p_type,
        p_mode,
        p_amount,
        p_description,
        p_metadata,
        p_created_by
    ) RETURNING id INTO v_new_id;

    -- 3. Get Updated Balance (Trigger should have fired)
    SELECT wallet_amount INTO v_current_balance FROM public.riders WHERE id = p_rider_id;

    -- 4. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_new_id,
        'new_balance', v_current_balance
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
