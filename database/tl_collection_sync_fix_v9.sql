-- TL COLLECTION SYNC FIX V9 (Ultimate Timezone Fix)
-- 1. Corrects the timezone shift for transactions between midnight and 5:30 AM IST.
-- 2. Restores the daily_collections table with 100% accurate IST dates.

BEGIN;

-- 1. Create missing indices if any
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_transaction_date ON public.wallet_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_type_mode ON public.wallet_ledger(transaction_type, mode);

-- 2. Fixed Trigger Function
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_date DATE;
    v_tl_id UUID;
    v_amount NUMERIC;
BEGIN
    -- Only process relevant types
    IF NEW.transaction_type NOT IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION') 
       OR NEW.mode != 'ADD' THEN
        RETURN NEW;
    END IF;

    -- Extract correct IST Date
    v_date := COALESCE(
        (NEW.metadata->>'date_on_sheet')::DATE,
        (NEW.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );

    -- Get Team Leader ID from Riders table
    SELECT team_leader_id INTO v_tl_id FROM public.riders WHERE id = NEW.rider_id;

    IF v_tl_id IS NOT NULL AND v_date IS NOT NULL THEN
        -- UPSERT into daily_collections
        INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
        VALUES (v_tl_id, v_date, NEW.amount, NOW())
        ON CONFLICT (team_leader_id, date)
        DO UPDATE SET 
            total_collection = (
                SELECT SUM(amount) 
                FROM public.wallet_ledger wl
                JOIN public.riders r ON wl.rider_id = r.id
                WHERE r.team_leader_id = EXCLUDED.team_leader_id
                  AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
                  AND wl.mode = 'ADD'
                  AND COALESCE((wl.metadata->>'date_on_sheet')::DATE, (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE) = EXCLUDED.date
            ),
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach Trigger
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics();

-- 4. FULL DATA REBUILD (Backfill)
TRUNCATE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
SELECT 
    r.team_leader_id,
    COALESCE(
        (wl.metadata->>'date_on_sheet')::DATE,
        (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    ) as txn_date,
    SUM(wl.amount) as total,
    NOW()
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
  AND wl.mode = 'ADD'
  AND r.team_leader_id IS NOT NULL
GROUP BY r.team_leader_id, txn_date
ON CONFLICT (team_leader_id, date) DO UPDATE SET 
    total_collection = EXCLUDED.total_collection,
    updated_at = NOW();

COMMIT;
