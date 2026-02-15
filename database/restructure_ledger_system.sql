-- Phase 2: Ledger System Restructure & Debt Model

-- 1. Create Rent Master Table
CREATE TABLE IF NOT EXISTS public.rent_master (
    rider_id UUID PRIMARY KEY REFERENCES public.riders(id) ON DELETE CASCADE,
    daily_rent_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for rent_master
ALTER TABLE public.rent_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access on rent_master" ON public.rent_master
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- 2. Create Wallet Snapshots Table
CREATE TABLE IF NOT EXISTS public.wallet_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
    snapshot_balance NUMERIC NOT NULL,
    snapshot_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('RIDER_IMPORT', 'WALLET_UPDATE', 'MANUAL_SNAPSHOT')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for wallet_snapshots
ALTER TABLE public.wallet_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access on wallet_snapshots" ON public.wallet_snapshots
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- 3. Modify Wallet Ledger Table
-- Adding fields for strict tracking
ALTER TABLE public.wallet_ledger 
ADD COLUMN IF NOT EXISTS external_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('SYSTEM', 'IMPORT', 'MANUAL')),
ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Add Unique Constraint on external_transaction_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_ledger_external_txn_id 
ON public.wallet_ledger(external_transaction_id) 
WHERE external_transaction_id IS NOT NULL;


-- 4. Update Balance Calculation Logic (DEBT MODEL - FIRST SNAPSHOT BASELINE)
CREATE OR REPLACE FUNCTION public.recalculate_rider_wallet_balance(target_rider_id UUID)
RETURNS VOID AS $$
DECLARE
    first_snapshot RECORD;
    total_add NUMERIC := 0;
    total_subtract NUMERIC := 0;
    base_balance NUMERIC := 0;
    base_time TIMESTAMP WITH TIME ZONE := '-infinity';
    final_balance NUMERIC := 0;
BEGIN
    -- A. Find the FIRST Snapshot (Opening Balance)
    SELECT * INTO first_snapshot
    FROM public.wallet_snapshots
    WHERE rider_id = target_rider_id
    ORDER BY snapshot_date ASC, created_at ASC
    LIMIT 1;

    IF FOUND THEN
        base_balance := first_snapshot.snapshot_balance;
        base_time := first_snapshot.snapshot_date;
    END IF;

    -- B. Sum ADDs (Collections/Credits) -> Increases Balance (Positive)
    SELECT COALESCE(SUM(amount), 0) INTO total_add
    FROM public.wallet_ledger
    WHERE rider_id = target_rider_id 
      AND mode = 'ADD' 
      AND transaction_date >= base_time;

    -- C. Sum SUBTRACTs (Rent/Debits) -> Decreases Balance (Negative)
    SELECT COALESCE(SUM(amount), 0) INTO total_subtract
    FROM public.wallet_ledger
    WHERE rider_id = target_rider_id 
      AND mode = 'SUBTRACT' 
      AND transaction_date >= base_time;

    -- D. Calculate Final Balance (Standard Wallet Model)
    -- Balance = Opening + Credits - Debits
    final_balance := base_balance + total_add - total_subtract;

    -- E. Update Cache
    UPDATE public.riders
    SET wallet_amount = final_balance
    WHERE id = target_rider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Updated RPC: add_wallet_transaction (Supports new fields)
CREATE OR REPLACE FUNCTION public.add_wallet_transaction(
    p_rider_id UUID,
    p_amount NUMERIC,
    p_type TEXT,
    p_mode TEXT,
    p_description TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_external_id TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'MANUAL',
    p_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
    v_new_id UUID;
    v_rider_exists BOOLEAN;
BEGIN
    -- Validate Rider
    SELECT EXISTS(SELECT 1 FROM public.riders WHERE id = p_rider_id) INTO v_rider_exists;
    IF NOT v_rider_exists THEN
        RAISE EXCEPTION 'Rider not found';
    END IF;

    -- Validate Mode
    IF p_mode NOT IN ('ADD', 'SUBTRACT', 'SET') THEN
         RAISE EXCEPTION 'Invalid mode. Must be ADD, SUBTRACT, or SET.';
    END IF;

    -- Insert Transaction
    INSERT INTO public.wallet_ledger (
        rider_id,
        transaction_type,
        mode,
        amount,
        description,
        metadata,
        created_by,
        external_transaction_id,
        source_type,
        transaction_date
    ) VALUES (
        p_rider_id,
        p_type,
        p_mode,
        p_amount,
        p_description,
        p_metadata,
        auth.uid(), -- Current User
        p_external_id,
        p_source,
        p_date
    ) RETURNING id INTO v_new_id;

    -- Trigger will auto-update balance

    RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
