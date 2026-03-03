-- ════════════════════════════════════════════════════════════════════════════
-- ULTIMATE COLLECTION CONSISTENCY FIX (V18 - FINAL)
-- ════════════════════════════════════════════════════════════════════════════
-- Resolves the "Date Shift" and "Missing Amount" issues by unifying date logic.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. UNIFIED DATE RESOLVER
-- This is the SINGLE SOURCE OF TRUTH for how a transaction's date is determined.
CREATE OR REPLACE FUNCTION public.get_ledger_date(p_metadata JSONB, p_transaction_date DATE, p_created_at TIMESTAMPTZ)
RETURNS DATE AS $$
BEGIN
    -- Order of Priority:
    -- 1. Explicit transaction_date (updated by UI 'Edit Date')
    -- 2. metadata->date_on_sheet (updated by UI 'Edit Date' and Import)
    -- 3. created_at (Fallback converted to IST)
    RETURN COALESCE(
        p_transaction_date, 
        (p_metadata->>'date_on_sheet')::DATE, 
        (p_created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );
EXCEPTION WHEN OTHERS THEN
    -- Safety fallback to created_at IST if parsing fails
    RETURN (p_created_at AT TIME ZONE 'Asia/Kolkata')::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- 2. STANDARDIZED RECALCULATION HELPER
CREATE OR REPLACE FUNCTION public.recalculate_daily_collection_for_date(p_tl_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_total_collection NUMERIC := 0;
    v_active_count INTEGER := 1;
BEGIN
    -- Recalculate total collection specifically for this TL on this DATE
    SELECT COALESCE(SUM(wl.amount), 0) INTO v_total_collection
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE r.team_leader_id = p_tl_id
    AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
    AND wl.mode = 'ADD'
    -- Using the unified date resolver
    AND public.get_ledger_date(wl.metadata, wl.transaction_date, wl.created_at) = p_date;

    -- Calculate historical active count for that date (IST Aware)
    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.riders
    WHERE team_leader_id = p_tl_id 
      AND status != 'deleted'
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= p_date
      AND (inactivated_at IS NULL OR (inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > p_date);

    IF v_active_count = 0 THEN v_active_count := 1; END IF;

    -- Upsert the corrected value
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    VALUES (p_tl_id, p_date, v_total_collection, v_active_count, NOW())
    ON CONFLICT (team_leader_id, date)
    DO UPDATE SET 
        total_collection = EXCLUDED.total_collection,
        active_riders_count = EXCLUDED.active_riders_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. UNIFIED SYNC TRIGGER
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics_final()
RETURNS TRIGGER AS $$
DECLARE
    v_new_tl_id UUID;
    v_old_tl_id UUID;
    v_new_date DATE;
    v_old_date DATE;
BEGIN
    -- HANDLE DELETIONS & UPDATES (Old State)
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        IF OLD.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION') AND OLD.mode = 'ADD' THEN
            SELECT team_leader_id INTO v_old_tl_id FROM public.riders WHERE id = OLD.rider_id;
            -- Using same unified logic
            v_old_date := public.get_ledger_date(OLD.metadata, OLD.transaction_date, OLD.created_at);

            IF v_old_tl_id IS NOT NULL THEN
                PERFORM public.recalculate_daily_collection_for_date(v_old_tl_id, v_old_date);
            END IF;
        END IF;
    END IF;

    -- HANDLE INSERTIONS & UPDATES (New State)
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION') AND NEW.mode = 'ADD' THEN
            SELECT team_leader_id INTO v_new_tl_id FROM public.riders WHERE id = NEW.rider_id;
            -- Using same unified logic
            v_new_date := public.get_ledger_date(NEW.metadata, NEW.transaction_date, NEW.created_at);

            IF v_new_tl_id IS NOT NULL THEN
                PERFORM public.recalculate_daily_collection_for_date(v_new_tl_id, v_new_date);
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RE-ATTACH TRIGGER
DROP TRIGGER IF EXISTS trg_sync_ledger_to_daily_metrics ON public.wallet_ledger;
CREATE TRIGGER trg_sync_ledger_to_daily_metrics
    AFTER INSERT OR UPDATE OR DELETE ON public.wallet_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_daily_metrics_final();


-- 5. UPGRADED DATE UPDATE RPC
-- Standardizes the update to be recognized as IST midnight by the trigger
CREATE OR REPLACE FUNCTION public.update_wallet_transaction_date(
    p_transaction_id UUID,
    p_new_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
    v_new_date DATE := (p_new_date AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
    -- Verify Permission
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can modify transaction dates.';
    END IF;

    -- Update Record
    -- The trigger above (sync_ledger_to_daily_metrics_final) will auto-handle 
    -- the recalculation for BOTH OLD and NEW dates accurately using get_ledger_date.
    UPDATE public.wallet_ledger
    SET 
        created_at = p_new_date,
        transaction_date = v_new_date,
        updated_at = NOW(),
        metadata = jsonb_set(
            jsonb_set(
                COALESCE(metadata, '{}'::jsonb), 
                '{date_modified_by}', to_jsonb(auth.uid()::text)
            ),
            '{date_on_sheet}', to_jsonb(v_new_date::text)
        )
    WHERE id = p_transaction_id;

    RETURN jsonb_build_object('success', true, 'message', 'Transaction moved to ' || v_new_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. FULL DATA RE-SYNC (Final Check)
TRUNCATE TABLE public.daily_collections;

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
SELECT 
    sub.tl_id,
    sub.v_date,
    sub.total,
    GREATEST(
        (
            SELECT COUNT(*)::INTEGER 
            FROM public.riders r2 
            WHERE r2.team_leader_id = sub.tl_id 
            AND r2.status != 'deleted'
            AND (r2.created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= sub.v_date
            AND (r2.inactivated_at IS NULL OR (r2.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > sub.v_date)
        ), 
        1 
    ) as historical_active_count,
    NOW()
FROM (
    SELECT 
        r.team_leader_id as tl_id,
        public.get_ledger_date(wl.metadata, wl.transaction_date, wl.created_at) as v_date,
        SUM(wl.amount) as total
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
      AND wl.mode = 'ADD'
      AND r.team_leader_id IS NOT NULL 
    GROUP BY r.team_leader_id, v_date
) sub;

COMMIT;
