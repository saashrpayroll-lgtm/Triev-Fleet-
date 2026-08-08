-- FUNCTION: Synch changes in wallet_ledger to daily_collections (INSERT, UPDATE, DELETE)
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_team_leader_id UUID;
    v_transaction_date DATE;
    v_amount NUMERIC;
    v_old_date DATE;
    v_old_amount NUMERIC;
    v_old_tl_id UUID;
BEGIN
    -- HANDLE DELETIONS & UPDATES (Decrement Old Values)
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        -- 1. Identify if OLD record was a relevant Daily Collection
        IF OLD.transaction_type = 'DAILY_COLLECTION' AND OLD.mode = 'ADD' THEN
             
             -- Get TL ID (from OLD record)
             SELECT team_leader_id INTO v_old_tl_id
             FROM public.riders
             WHERE id = OLD.rider_id;

             IF v_old_tl_id IS NOT NULL THEN
                -- Determine Old Date
                IF OLD.transaction_date IS NOT NULL THEN
                    v_old_date := OLD.transaction_date;
                ELSIF OLD.metadata->>'date_on_sheet' IS NOT NULL THEN
                    -- Parse the date_on_sheet value, treating it as IST by extracting date part
                    v_old_date := (OLD.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata';
                ELSE
                    -- ✅ FIX: Use IST timezone for date extraction (was UTC, wrong for AM IST rows)
                    v_old_date := (OLD.created_at AT TIME ZONE 'Asia/Kolkata')::DATE;
                END IF;

                v_old_amount := OLD.amount;

                -- DECREMENT from Old Date
                UPDATE public.daily_collections
                SET 
                    total_collection = total_collection - v_old_amount,
                    updated_at = NOW()
                WHERE team_leader_id = v_old_tl_id AND date = v_old_date;

                -- Optional: Cleanup if 0 (keep records for now to avoid gaps, or delete if preferred)
                -- DELETE FROM public.daily_collections WHERE total_collection = 0;
             END IF;
        END IF;
    END IF;

    -- HANDLE INSERTIONS & UPDATES (Increment New Values)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- 1. Filter Strict
        IF NEW.transaction_type = 'DAILY_COLLECTION' AND NEW.mode = 'ADD' THEN
            
            -- Get TL ID
            SELECT team_leader_id INTO v_team_leader_id
            FROM public.riders
            WHERE id = NEW.rider_id;

            IF v_team_leader_id IS NOT NULL THEN
                 -- Determine New Date
                IF NEW.transaction_date IS NOT NULL THEN
                    v_transaction_date := NEW.transaction_date;
                ELSIF NEW.metadata->>'date_on_sheet' IS NOT NULL THEN
                    -- Parse the date_on_sheet value as IST timestamp, extract IST date
                    v_transaction_date := (NEW.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata';
                ELSE
                    -- ✅ FIX: Use IST timezone for date extraction (was UTC, wrong for AM IST rows)
                    v_transaction_date := (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::DATE;
                END IF;

                v_amount := NEW.amount;

                -- UPSERT (Increment)
                INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
                VALUES (v_team_leader_id, v_transaction_date, v_amount, NOW())
                ON CONFLICT (team_leader_id, date)
                DO UPDATE SET 
                    total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
                    updated_at = NOW();
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- TRIGGER RECREATION
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;

CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();
