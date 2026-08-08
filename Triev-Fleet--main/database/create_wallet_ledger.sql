-- 1. Create Wallet Ledger Table
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('SYSTEM_IMPORT', 'MANUAL_ADJUSTMENT', 'DAILY_COLLECTION')),
    mode TEXT NOT NULL CHECK (mode IN ('SET', 'ADD', 'SUBTRACT')),
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Stores reference_source, distinct_id, etc.
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    month_lock BOOLEAN DEFAULT FALSE
);

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_rider_date ON public.wallet_ledger(rider_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_metadata_unique ON public.wallet_ledger USING gin (metadata);

-- 3. Function to Calculate and Update Rider Balance
CREATE OR REPLACE FUNCTION public.recalculate_rider_wallet_balance(target_rider_id UUID)
RETURNS VOID AS $$
DECLARE
    latest_set_record RECORD;
    total_add NUMERIC := 0;
    total_subtract NUMERIC := 0;
    base_balance NUMERIC := 0;
    base_time TIMESTAMP WITH TIME ZONE := '-infinity';
    final_balance NUMERIC := 0;
BEGIN
    -- A. Find the latest 'SET' transaction (Baseline)
    SELECT * INTO latest_set_record
    FROM public.wallet_ledger
    WHERE rider_id = target_rider_id AND mode = 'SET'
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        base_balance := latest_set_record.amount;
        base_time := latest_set_record.created_at;
    END IF;

    -- B. Sum ADDs after baseline
    SELECT COALESCE(SUM(amount), 0) INTO total_add
    FROM public.wallet_ledger
    WHERE rider_id = target_rider_id 
      AND mode = 'ADD' 
      AND created_at > base_time;

    -- C. Sum SUBTRACTs after baseline
    SELECT COALESCE(SUM(amount), 0) INTO total_subtract
    FROM public.wallet_ledger
    WHERE rider_id = target_rider_id 
      AND mode = 'SUBTRACT' 
      AND created_at > base_time;

    -- D. Calculate Final
    final_balance := base_balance + total_add - total_subtract;

    -- E. Update Cache in Riders Table
    UPDATE public.riders
    SET wallet_amount = final_balance
    WHERE id = target_rider_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger to Auto-Update Balance on Ledger Change
CREATE OR REPLACE FUNCTION public.trigger_update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.recalculate_rider_wallet_balance(OLD.rider_id);
    ELSE
        PERFORM public.recalculate_rider_wallet_balance(NEW.rider_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_wallet_balance ON public.wallet_ledger;
CREATE TRIGGER trg_update_wallet_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_update_wallet_balance();

-- 5. RLS Policies
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access" ON public.wallet_ledger
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Team Leaders view their riders ledger" ON public.wallet_ledger
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.riders 
            WHERE riders.id = wallet_ledger.rider_id 
            AND riders.team_leader_id = auth.uid()
        )
    );
