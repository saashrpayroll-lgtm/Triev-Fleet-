-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTO-CLEANUP ROUTINE: PRUNE OLD WALLET LEDGER DATA (21+ DAYS)
-- ═══════════════════════════════════════════════════════════════════════════════
-- This script securely deletes raw rows from wallet_ledger that are older than
-- 21 days to prevent heavy database bloat.
--
-- CRITICAL SAFETY FEATURE: 
-- It temporarily disables the `trg_sync_ledger_to_daily_metrics` trigger 
-- during the deletion. This guarantees that historical Daily Collections and 
-- Team Leader Performance / Leaderboard metrics are perfectly preserved and 
-- NOT downgraded when the old raw data is deleted.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.prune_old_wallet_ledger_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_cutoff_date DATE;
BEGIN
    -- Calculate the exact cutoff date (21 days ago in IST time)
    v_cutoff_date := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE - INTERVAL '21 days';

    -- 1. Disable the daily metrics sync trigger entirely for this transaction
    --    so our DELETES do not cause the daily_collections to sum to zero.
    ALTER TABLE public.wallet_ledger DISABLE TRIGGER trg_sync_ledger_to_daily_metrics;

    -- 2. Execute the raw deletions based on the effective ledger date
    WITH deleted_rows AS (
        DELETE FROM public.wallet_ledger
        WHERE public.ledger_effective_date(wallet_ledger) < v_cutoff_date
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted_rows;

    -- 3. IMMEDIATELY re-enable the trigger to protect regular traffic
    ALTER TABLE public.wallet_ledger ENABLE TRIGGER trg_sync_ledger_to_daily_metrics;

    -- 4. Return the summary to the frontend
    RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'cutoff_date', v_cutoff_date,
        'message', 'Successfully pruned ' || v_deleted_count || ' legacy ledger records older than 21 days.'
    );

EXCEPTION WHEN OTHERS THEN
    -- If anything fails, GUARANTEE the main trigger is turned back on
    ALTER TABLE public.wallet_ledger ENABLE TRIGGER trg_sync_ledger_to_daily_metrics;
    
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'deleted_count', 0
    );
END;
$$;
