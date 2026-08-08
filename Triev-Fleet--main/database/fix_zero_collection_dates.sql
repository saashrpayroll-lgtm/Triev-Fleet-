-- ════════════════════════════════════════════════════════════════════════════
-- CLEANUP: Delete 0-collection rows automatically on recalculation
-- ════════════════════════════════════════════════════════════════════════════

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
    AND public.is_collection_txn(wl.transaction_type)
    AND wl.mode = 'ADD'
    AND public.get_ledger_date_v20(wl.metadata, wl.transaction_date::TIMESTAMPTZ, wl.created_at) = p_date;

    IF v_total_collection = 0 THEN
        -- If collection is exactly 0 after recalculation, remove the row.
        -- This prevents ghost/future dates from lingering after date correction.
        DELETE FROM public.daily_collections
        WHERE team_leader_id = p_tl_id AND date = p_date;
    ELSE
        -- Historical active count for that date
        SELECT COUNT(*)::INTEGER INTO v_active_count
        FROM public.riders
        WHERE team_leader_id = p_tl_id 
          AND status != 'deleted'
          AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= p_date
          AND (inactivated_at IS NULL OR (inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > p_date);

        IF v_active_count = 0 THEN v_active_count := 1; END IF;

        -- Upsert
        INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
        VALUES (p_tl_id, p_date, v_total_collection, v_active_count, NOW())
        ON CONFLICT (team_leader_id, date)
        DO UPDATE SET 
            total_collection = EXCLUDED.total_collection,
            active_riders_count = EXCLUDED.active_riders_count,
            updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup existing 0-collection rows just in case
DELETE FROM public.daily_collections WHERE total_collection = 0;
