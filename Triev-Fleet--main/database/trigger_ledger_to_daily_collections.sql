-- Trigger to sync wallet_ledger ADD transactions to daily_collections (Aggregated by TL & Date)
-- This ensures Charts and Performance Tables (which use daily_collections) are updated automatically.

CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
BEGIN
    -- 1. Get Team Leader ID for the rider
    SELECT team_leader_id INTO v_team_leader_id
    FROM public.riders
    WHERE id = NEW.rider_id;

    -- If no Team Leader, we cannot attribute this to a TL performance record.
    -- (Admin dashboard might still see it via direct ledger query, but daily_collections is TL-centric)
    IF v_team_leader_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 2. Determine Amount and Logic
    -- STRICT FILTER: Only 'DAILY_COLLECTION' (from Bulk Rent Import) constitutes 'FTD Collection'.
    -- Manual Adjustments, Reconciliations, and System Imports should NOT pollute the Daily Collection Stats.
    
    IF NEW.transaction_type = 'DAILY_COLLECTION' AND NEW.mode = 'ADD' THEN
        v_amount := NEW.amount;
    ELSE
        -- Helper for any other types (MANUAL_ADJUSTMENT, SYSTEM_RENT_CHARGE, etc.) -> IGNORE.
        RETURN NULL; 
    END IF;

    -- 3. Determine Date
    -- Use metadata date if available (backdated import), else created_at
    IF NEW.metadata->>'date_on_sheet' IS NOT NULL THEN
        v_transaction_date := (NEW.metadata->>'date_on_sheet')::DATE;
    ELSE
        v_transaction_date := NEW.created_at::DATE;
    END IF;

    -- 4. Upsert into daily_collections
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection)
    VALUES (v_team_leader_id, v_transaction_date, v_amount)
    ON CONFLICT (team_leader_id, date)
    DO UPDATE SET 
        total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
        updated_at = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Trigger
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();
