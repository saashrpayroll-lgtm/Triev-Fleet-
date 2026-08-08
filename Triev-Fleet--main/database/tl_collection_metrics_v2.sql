-- TL COLLECTION METRICS V2: Track Historical Rider Counts
-- 1. Add column to track how many riders a TL had on that specific date
-- 2. Update trigger to populate this count automatically
-- 3. Backfill existing data

BEGIN;

-- 1. Add Column
ALTER TABLE public.daily_collections 
ADD COLUMN IF NOT EXISTS active_riders_count INTEGER DEFAULT 0;

-- 2. Update Sync Function to include Rider Count logic
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
    IF NEW.metadata->>'date_on_sheet' IS NOT NULL THEN
        v_transaction_date := (NEW.metadata->>'date_on_sheet')::DATE;
    ELSE
        v_transaction_date := NEW.transaction_date::DATE;
    END IF;

    -- Fallback
    IF v_transaction_date IS NULL THEN
        v_transaction_date := NEW.created_at::DATE;
    END IF;

    -- Calculate Active Rider Count for this TL on THIS SPECIFIC DATE
    -- We look at riders who were allotted before/on this date AND (not inactivated OR inactivated AFTER this date)
    SELECT COUNT(*)::INTEGER INTO v_rider_count
    FROM public.riders
    WHERE team_leader_id = v_team_leader_id
    AND allotment_date::DATE <= v_transaction_date
    AND (
        inactivated_at IS NULL 
        OR inactivated_at::DATE > v_transaction_date
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

-- 3. Backfill Existing Data
-- Update existing records with the rider counts they had on those dates
UPDATE public.daily_collections dc
SET active_riders_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.riders r
    WHERE r.team_leader_id = dc.team_leader_id
    AND r.allotment_date::DATE <= dc.date
    AND (
        r.inactivated_at IS NULL 
        OR r.inactivated_at::DATE > dc.date
    )
);

-- Ensure no zeros
UPDATE public.daily_collections SET active_riders_count = 1 WHERE active_riders_count = 0 OR active_riders_count IS NULL;

COMMIT;
