-- ENABLE WALLET DATE UPDATES
-- Adds robust single and bulk date update capabilities for wallet transactions.
-- Ensures that changing a transaction date correctly recalculates the Team Leader performance metrics.

BEGIN;

-- 1. Helper Function: Recalculate Daily Collection for a specific TL and Date
-- This acts as the source of truth for repairing daily collections after a date change.
CREATE OR REPLACE FUNCTION public.recalculate_daily_collection_for_date(p_tl_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_total_collection NUMERIC := 0;
    v_rider_count INTEGER := 1;
BEGIN
    -- A. Recalculate total collection
    SELECT COALESCE(SUM(wl.amount), 0) INTO v_total_collection
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE r.team_leader_id = p_tl_id
    AND wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION')
    AND wl.mode = 'ADD'
    AND COALESCE(
        public.safe_cast_to_date(wl.metadata->>'date_on_sheet'), 
        public.safe_cast_to_date(wl.transaction_date::text), 
        wl.created_at::DATE
    ) = p_date;

    -- B. Recalculate active riders count
    SELECT COUNT(*)::INTEGER INTO v_rider_count
    FROM public.riders
    WHERE team_leader_id = p_tl_id
    AND (
        public.safe_cast_to_date(allotment_date::text) IS NOT NULL 
        AND public.safe_cast_to_date(allotment_date::text) <= p_date
    )
    AND (
        inactivated_at IS NULL 
        OR TRIM(inactivated_at::text) = '' 
        OR public.safe_cast_to_date(inactivated_at::text) IS NULL 
        OR public.safe_cast_to_date(inactivated_at::text) > p_date
    );

    IF v_rider_count = 0 THEN
        v_rider_count := 1;
    END IF;

    -- C. Upsert into daily_collections
    IF v_total_collection = 0 THEN
        -- If no collections remain for this date, delete or set to 0. 
        -- Setting to 0 preserves the rider count metric which might be useful.
        UPDATE public.daily_collections
        SET total_collection = 0,
            active_riders_count = GREATEST(v_rider_count, active_riders_count),
            updated_at = NOW()
        WHERE team_leader_id = p_tl_id AND date = p_date;
    ELSE
        INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
        VALUES (p_tl_id, p_date, v_total_collection, v_rider_count, NOW())
        ON CONFLICT (team_leader_id, date)
        DO UPDATE SET 
            total_collection = EXCLUDED.total_collection,
            active_riders_count = GREATEST(v_rider_count, daily_collections.active_riders_count),
            updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Enhanced Single Update Function
CREATE OR REPLACE FUNCTION public.update_wallet_transaction_date(
    p_transaction_id UUID,
    p_new_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
    v_old_entry RECORD;
    v_tl_id UUID;
    v_old_date DATE;
    v_new_date DATE := p_new_date::DATE;
BEGIN
    -- A. Verify Permission
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can modify transaction dates.';
    END IF;

    -- B. Fetch Existing Record
    SELECT * INTO v_old_entry FROM public.wallet_ledger WHERE id = p_transaction_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction % not found.', p_transaction_id;
    END IF;

    -- Determine the effective old date
    v_old_date := COALESCE(
        public.safe_cast_to_date(v_old_entry.metadata->>'date_on_sheet'), 
        public.safe_cast_to_date(v_old_entry.transaction_date::text), 
        v_old_entry.created_at::DATE
    );

    -- Fetch Rider's TL
    SELECT team_leader_id INTO v_tl_id FROM public.riders WHERE id = v_old_entry.rider_id;

    -- C. Update Record (Overwrite date in all possible fields)
    UPDATE public.wallet_ledger
    SET 
        created_at = p_new_date,
        transaction_date = v_new_date,
        metadata = jsonb_set(
            jsonb_set(
                COALESCE(metadata, '{}'::jsonb), 
                '{date_modified_by}', to_jsonb(auth.uid())
            ),
            '{date_on_sheet}', to_jsonb(v_new_date::text)
        )
    WHERE id = p_transaction_id;

    -- D. Recalculate Metrics IF this was a Daily/Rent Collection and the date actually changed
    IF v_tl_id IS NOT NULL AND v_old_entry.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION') AND v_old_entry.mode = 'ADD' THEN
        IF v_old_date <> v_new_date THEN
            -- Recalculate old date (it will lose this transaction's amount)
            PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_old_date);
            -- Recalculate new date (it will gain this transaction's amount)
            PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_new_date);
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Date updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Bulk Update Function
CREATE OR REPLACE FUNCTION public.bulk_update_wallet_transaction_date(
    p_transaction_ids UUID[],
    p_new_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
    txn_id UUID;
    v_updated_count INT := 0;
BEGIN
    -- Verify Permission
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can bulk modify transaction dates.';
    END IF;

    -- Iterate and reuse the single update logic
    FOREACH txn_id IN ARRAY p_transaction_ids
    LOOP
        -- This internally handles recalculating the metrics perfectly per transaction
        PERFORM public.update_wallet_transaction_date(txn_id, p_new_date);
        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'message', v_updated_count || ' transactions updated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
