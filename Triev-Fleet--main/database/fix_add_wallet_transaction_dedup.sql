-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: Add Duplicate Protection to add_wallet_transaction() RPC
--
-- PROBLEM: The RPC function always does a plain INSERT with no ON CONFLICT.
-- When collection data is imported multiple times with the same
-- external_transaction_id (Transaction ID from CSV), it creates duplicate
-- rows instead of skipping them.
--
-- FIX: Check for existing external_transaction_id before inserting.
-- If a row with the same external_transaction_id already exists, skip
-- the insert and return a 'skipped' response.
--
-- Run this ENTIRE script in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- First, ensure the external_transaction_id column has a UNIQUE constraint
-- (it may already exist, so use IF NOT EXISTS pattern)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'wallet_ledger_external_transaction_id_key'
    ) THEN
        -- Add unique constraint, but allow NULLs (multiple NULL values are fine)
        ALTER TABLE public.wallet_ledger 
        ADD CONSTRAINT wallet_ledger_external_transaction_id_key 
        UNIQUE (external_transaction_id);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    -- Constraint already exists, no action needed
    NULL;
END $$;

-- Now recreate add_wallet_transaction with duplicate protection
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

    -- ★ FIX: Duplicate check — if external_transaction_id is provided and already exists, SKIP
    IF p_external_id IS NOT NULL AND p_external_id != '' THEN
        IF EXISTS (
            SELECT 1 FROM public.wallet_ledger 
            WHERE external_transaction_id = p_external_id
        ) THEN
            -- Already exists — return skipped response instead of inserting duplicate
            SELECT wallet_amount INTO v_current_balance FROM public.riders WHERE id = p_rider_id;
            RETURN jsonb_build_object(
                'success', true, 
                'skipped', true, 
                'reason', 'Duplicate external_transaction_id: ' || p_external_id,
                'new_balance', COALESCE(v_current_balance, 0)
            );
        END IF;
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

COMMIT;
