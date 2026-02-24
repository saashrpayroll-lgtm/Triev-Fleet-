-- TL COLLECTION SYNC FIX V3: Safe Date Casting
-- Resolves "All entries failed" during Rent Collection import.
-- Cause: Malformed dates in 'allotment_date' or 'inactivated_at' string columns 
-- caused ::DATE casting to crash the entire wallet insert transaction.

BEGIN;

-- 1. Helper function to safely cast string to date, returning NULL if invalid
CREATE OR REPLACE FUNCTION public.safe_cast_to_date(p_date_text TEXT)
RETURNS DATE AS $$
BEGIN
    IF p_date_text IS NULL OR TRIM(p_date_text) = '' OR TRIM(p_date_text) = 'N/A' THEN
        RETURN NULL;
    END IF;
    RETURN p_date_text::DATE;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Update Sync Function to use safe casting
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
    v_rider_count INTEGER;
BEGIN
    -- Get Team Leader ID for the rider
    SELECT team_leader_id INTO v_team_leader_id
    FROM public.riders
    WHERE id = NEW.rider_id;

    -- If no Team Leader, skip
    IF v_team_leader_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- FILTER: Both 'DAILY_COLLECTION' and 'RENT_COLLECTION' addition counts
    IF NEW.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION') AND NEW.mode = 'ADD' THEN
        v_amount := NEW.amount;
    ELSE
        RETURN NULL; 
    END IF;

    -- Determine Date
    IF NEW.metadata->>'date_on_sheet' IS NOT NULL AND TRIM(NEW.metadata->>'date_on_sheet') <> '' THEN
        v_transaction_date := public.safe_cast_to_date(NEW.metadata->>'date_on_sheet');
    END IF;
    
    IF v_transaction_date IS NULL AND NEW.transaction_date IS NOT NULL THEN
        v_transaction_date := public.safe_cast_to_date(NEW.transaction_date::text);
    END IF;

    -- Fallback
    IF v_transaction_date IS NULL THEN
        v_transaction_date := NEW.created_at::DATE;
    END IF;

    -- Calculate Active Rider Count for this TL on THIS SPECIFIC DATE using SAFE CASTING
    -- We look at riders who were allotted before/on this date AND (not inactivated OR inactivated AFTER this date)
    SELECT COUNT(*)::INTEGER INTO v_rider_count
    FROM public.riders
    WHERE team_leader_id = v_team_leader_id
    AND (
        public.safe_cast_to_date(allotment_date::text) IS NOT NULL 
        AND public.safe_cast_to_date(allotment_date::text) <= v_transaction_date
    )
    AND (
        inactivated_at IS NULL 
        OR TRIM(inactivated_at::text) = '' 
        OR public.safe_cast_to_date(inactivated_at::text) IS NULL 
        OR public.safe_cast_to_date(inactivated_at::text) > v_transaction_date
    );

    -- Ensure count is at least 1 if we've received a collection (prevents division by zero)
    IF v_rider_count = 0 THEN
        v_rider_count := 1;
    END IF;

    -- Upsert into daily_collections
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    VALUES (v_team_leader_id, v_transaction_date, v_amount, v_rider_count, NOW())
    ON CONFLICT (team_leader_id, date)
    DO UPDATE SET 
        total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
        active_riders_count = GREATEST(v_rider_count, daily_collections.active_riders_count), -- Keep the highest count found for that day
        updated_at = NOW();

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
