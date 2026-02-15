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
    -- We only care about adding funds (Collections)
    -- If mode is 'ADD', we increment.
    -- If mode is 'SUBTRACT' (and it was a correction to a collection?), maybe decrement?
    -- For now, let's strictly handle 'ADD' as positive collection.
    -- Also check type? RENT_COLLECTION, DAILY_COLLECTION. 
    -- 'MANUAL_ADJUSTMENT' with mode 'ADD' should also count as collection? Yes.
    
    v_amount := NEW.amount;
    
    IF NEW.mode = 'ADD' THEN
        -- Positive impact on collection
    ELSIF NEW.mode = 'SUBTRACT' AND TG_OP = 'INSERT' THEN
        -- Negative impact? (Refund). 
        -- If we subtract from wallet, does it mean we returned money? 
        -- For 'daily_collections' (performance), usually we want Net Collection.
        v_amount := -NEW.amount;
    ELSE
        -- Helper for SET mode? Complex. Let's stick to ADD/SUBTRACT relative changes.
        RETURN NULL; -- Ignore SET for daily stats for now
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
