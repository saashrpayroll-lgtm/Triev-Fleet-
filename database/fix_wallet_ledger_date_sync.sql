-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Wallet Ledger Schema & Date Update Logic
-- ════════════════════════════════════════════════════════════════════════════
-- 1. Add missing updated_at column
-- 2. Refine transaction date update RPC for accuracy
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. ADD MISSING UPDATED_AT COLUMN
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallet_ledger' AND column_name='updated_at') THEN
        ALTER TABLE public.wallet_ledger ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2. REUSE OR UPDATE THE RECALCULATION HELPER
-- Ensure we have a reliable way to fix daily_collections after a backdate
CREATE OR REPLACE FUNCTION public.recalculate_daily_collection_for_date(p_tl_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_total_collection NUMERIC := 0;
    v_active_count INTEGER := 1;
BEGIN
    -- Recalculate total collection from ledger
    SELECT COALESCE(SUM(wl.amount), 0) INTO v_total_collection
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE r.team_leader_id = p_tl_id
    AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
    AND wl.mode = 'ADD'
    AND COALESCE(
        (wl.metadata->>'date_on_sheet')::DATE, 
        wl.transaction_date::DATE, 
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    ) = p_date;

    -- Calculate historical active count for that date
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


-- 3. FIX THE DATE UPDATE RPC
CREATE OR REPLACE FUNCTION public.update_wallet_transaction_date(
    p_transaction_id UUID,
    p_new_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
    v_old_entry RECORD;
    v_tl_id UUID;
    v_old_date DATE;
    v_new_date DATE := (p_new_date AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
    -- A. Verify Permission
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can modify transaction dates.';
    END IF;

    -- B. Fetch Existing Record
    SELECT * INTO v_old_entry FROM public.wallet_ledger WHERE id = p_transaction_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found.';
    END IF;

    -- Determine the effective old date
    v_old_date := COALESCE(
        (v_old_entry.metadata->>'date_on_sheet')::DATE, 
        v_old_entry.transaction_date::DATE, 
        (v_old_entry.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );

    -- Fetch Rider's TL
    SELECT team_leader_id INTO v_tl_id FROM public.riders WHERE id = v_old_entry.rider_id;

    -- C. Update Record
    UPDATE public.wallet_ledger
    SET 
        created_at = p_new_date,
        transaction_date = v_new_date, -- Sync both for safety
        updated_at = NOW(),
        metadata = jsonb_set(
            jsonb_set(
                COALESCE(metadata, '{}'::jsonb), 
                '{date_modified_by}', to_jsonb(auth.uid()::text)
            ),
            '{date_on_sheet}', to_jsonb(v_new_date::text)
        )
    WHERE id = p_transaction_id;

    -- D. Recalculate Metrics if it's a collection
    IF v_tl_id IS NOT NULL AND v_old_entry.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION') AND v_old_entry.mode = 'ADD' THEN
        IF v_old_date <> v_new_date THEN
            -- Fix old date total
            PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_old_date);
            -- Fix new date total
            PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_new_date);
        ELSE
            -- Just refresh current date
            PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_new_date);
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Transaction date and collections updated.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
