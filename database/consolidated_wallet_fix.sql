-- UNIFIED WALLET SYSTEM FIX (v2)
-- Consolidates legacy code, unifies SET/RESET modes, and fixes real-time sync.

-- 1. DROP ALL POTENTIAL DUPLICATE TRIGGERS (Cleanup)
DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.wallet_ledger;
DROP TRIGGER IF EXISTS trg_update_wallet_balance ON public.wallet_ledger;
DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON public.wallet_ledger;
DROP TRIGGER IF EXISTS on_wallet_ledger_change ON public.wallet_ledger;
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
DROP TRIGGER IF EXISTS trg_wallet_ledger_main_sync ON public.wallet_ledger;

-- 2. UNIFIED BALANCE CALCULATION (The Source of Truth)
-- Supports both 'SET' (Legacy) and 'RESET' (New) as valid baselines.
CREATE OR REPLACE FUNCTION public.calculate_rider_balance(p_rider_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_base_record RECORD;
    v_adds NUMERIC := 0;
    v_subtracts NUMERIC := 0;
BEGIN
    -- A. Find latest baseline (SET or RESET)
    SELECT amount, transaction_date, created_at
    INTO v_base_record
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id AND mode IN ('SET', 'RESET')
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1;

    -- B. Sum additions after baseline
    SELECT COALESCE(SUM(amount), 0) INTO v_adds
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'ADD'
      AND (
          (v_base_record.transaction_date IS NULL) OR 
          (transaction_date > v_base_record.transaction_date) OR
          (transaction_date = v_base_record.transaction_date AND created_at > v_base_record.created_at)
      );

    -- C. Sum subtractions after baseline
    SELECT COALESCE(SUM(amount), 0) INTO v_subtracts
    FROM public.wallet_ledger
    WHERE rider_id = p_rider_id 
      AND mode = 'SUBTRACT'
      AND (
          (v_base_record.transaction_date IS NULL) OR 
          (transaction_date > v_base_record.transaction_date) OR
          (transaction_date = v_base_record.transaction_date AND created_at > v_base_record.created_at)
      );

    -- D. Final Result
    RETURN COALESCE(v_base_record.amount, 0) + v_adds - v_subtracts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. LEGACY WRAPPER (For backward compatibility with other scripts)
CREATE OR REPLACE FUNCTION public.recalculate_rider_wallet_balance(target_rider_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM public.sync_wallet_balance_for_rider(target_rider_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. UNIFIED SYNC FUNCTION
CREATE OR REPLACE FUNCTION public.sync_wallet_balance_for_rider(p_rider_id UUID)
RETURNS VOID AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    v_new_balance := public.calculate_rider_balance(p_rider_id);
    
    UPDATE public.riders 
    SET wallet_amount = v_new_balance,
        updated_at = NOW()
    WHERE id = p_rider_id;
END;
$$ LANGUAGE plpgsql;

-- 5. UNIFIED TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.trigger_wallet_ledger_sync()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.sync_wallet_balance_for_rider(OLD.rider_id);
        RETURN OLD;
    ELSE
        PERFORM public.sync_wallet_balance_for_rider(NEW.rider_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. ATTACH UNIFIED TRIGGER
CREATE TRIGGER trg_wallet_ledger_main_sync
AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
FOR EACH ROW
EXECUTE FUNCTION public.trigger_wallet_ledger_sync();

-- 7. UNIFIED RPC: add_wallet_transaction
CREATE OR REPLACE FUNCTION public.add_wallet_transaction(
    p_rider_id UUID,
    p_amount NUMERIC,
    p_type TEXT,
    p_mode TEXT,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_external_id TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'MANUAL',
    p_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
    v_new_id UUID;
    v_current_balance NUMERIC;
    v_status TEXT;
BEGIN
    -- 0. Check Status
    SELECT status INTO v_status FROM public.riders WHERE id = p_rider_id;
    
    -- If rider is inactive, we only allow MANUAL adjustments, not automated ones.
    IF v_status = 'inactive' AND p_source = 'IMPORT' THEN
         RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Rider is inactive');
    END IF;

    -- Validate Mode
    IF p_mode NOT IN ('SET', 'RESET', 'ADD', 'SUBTRACT') THEN
         RAISE EXCEPTION 'Invalid mode. Must be SET, RESET, ADD, or SUBTRACT.';
    END IF;

    -- Insert Transaction
    INSERT INTO public.wallet_ledger (
        rider_id, transaction_type, mode, amount, description, metadata, external_transaction_id, source_type, transaction_date
    ) VALUES (
        p_rider_id, p_type, p_mode, p_amount, p_description, p_metadata, p_external_id, p_source, p_date
    ) RETURNING id INTO v_new_id;

    -- Trigger auto-syncs balance
    SELECT wallet_amount INTO v_current_balance FROM public.riders WHERE id = p_rider_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_id, 'new_balance', v_current_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. UNIFIED RPC: handle_daily_wallet_update
CREATE OR REPLACE FUNCTION public.handle_daily_wallet_update(
    p_rider_id UUID,
    p_new_balance NUMERIC,
    p_date TIMESTAMPTZ,
    p_external_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_system_balance NUMERIC;
    v_diff NUMERIC;
    v_ext_id TEXT;
BEGIN
    -- 1. Check if rider is inactive. If so, skip automated updates.
    IF EXISTS (SELECT 1 FROM public.riders WHERE id = p_rider_id AND status = 'inactive') THEN
        RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'Rider is inactive');
    END IF;

    -- 2. Get Current System Balance
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

    -- 4. Generate External ID
    IF p_external_id IS NULL THEN
        v_ext_id := 'RESET_' ||  p_rider_id || '_' || p_date::DATE;
    ELSE
        v_ext_id := p_external_id;
    END IF;

    -- 5. UPSERT RESET Transaction
    INSERT INTO public.wallet_ledger (
        rider_id, transaction_type, mode, amount, description, source_type, transaction_date, external_transaction_id
    ) VALUES (
        p_rider_id, 'DAY_OPENING_BALANCE', 'RESET', p_new_balance, 'Daily Wallet Update (Source)', 'IMPORT', p_date, v_ext_id
    )
    ON CONFLICT (external_transaction_id) 
    DO UPDATE SET 
        amount = EXCLUDED.amount,
        description = 'Daily Wallet Update (Source) - Corrected',
        transaction_date = EXCLUDED.transaction_date;

    -- Trigger auto-syncs balance
    
    RETURN jsonb_build_object('success', true, 'mismatch', v_diff <> 0, 'diff', v_diff, 'mode', 'UPSERT');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. FINAL RECALCULATION
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.riders LOOP
        PERFORM public.sync_wallet_balance_for_rider(r.id);
    END LOOP;
END $$;
