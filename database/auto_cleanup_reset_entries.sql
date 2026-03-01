-- ════════════════════════════════════════════════════════════════════════════
-- AUTO-CLEANUP: Old DAY_OPENING_BALANCE / RESET entries on Bulk Wallet Update
--
-- HOW TO RUN IN SUPABASE SQL EDITOR:
--   Step 1 — Paste and run PART 1 (the CREATE OR REPLACE FUNCTION block).
--   Step 2 — Paste and run PART 2 (the DELETE block) as a separate query.
--   Run AFTER: fix_collection_ist_and_daily_snapshot.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PART 1: Patch handle_daily_wallet_update
--   ✅ Auto-deletes previous-date RESET entries for a rider on each update
--   ✅ Keeps ONLY today's (IST) RESET entry per rider
--   ✅ ADD/SUBTRACT/DAILY_COLLECTION entries are NEVER touched
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.handle_daily_wallet_update(
    p_rider_id    UUID,
    p_new_balance NUMERIC,
    p_date        TIMESTAMPTZ,
    p_external_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today_ist     DATE;
    v_deleted_count INTEGER;
    v_ledger_id     UUID;
BEGIN
    -- 1. Resolve today in IST
    v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    -- 2. Auto-cleanup: delete ALL previous-date RESET entries for this rider
    --    Table alias 'wl' ensures p_rider_id is read as a parameter, not a column.
    DELETE FROM public.wallet_ledger wl
    WHERE wl.rider_id          = p_rider_id
      AND wl.mode              = 'RESET'
      AND wl.transaction_type  = 'DAY_OPENING_BALANCE'
      AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE < v_today_ist;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- 3. Upsert today's RESET entry (idempotent via external_transaction_id)
    INSERT INTO public.wallet_ledger (
        rider_id,
        amount,
        transaction_type,
        mode,
        description,
        metadata,
        external_transaction_id,
        created_at,
        transaction_date,
        source_type
    ) VALUES (
        p_rider_id,
        p_new_balance,
        'DAY_OPENING_BALANCE',
        'RESET',
        'Daily opening balance set via bulk wallet update',
        jsonb_build_object(
            'source',              'bulk_wallet_update',
            'ist_date',            v_today_ist::TEXT,
            'cleaned_old_entries', v_deleted_count
        ),
        COALESCE(p_external_id, 'RESET_' || p_rider_id::TEXT || '_' || v_today_ist::TEXT),
        COALESCE(p_date, NOW()),
        v_today_ist,
        'RESET'
    )
    ON CONFLICT (external_transaction_id)
    DO UPDATE SET
        amount     = EXCLUDED.amount,
        metadata   = EXCLUDED.metadata,
        created_at = NOW()
    RETURNING id INTO v_ledger_id;

    -- 4. Sync riders.wallet_amount
    UPDATE public.riders
    SET wallet_amount = p_new_balance,
        updated_at    = NOW()
    WHERE id = p_rider_id;

    RETURN jsonb_build_object(
        'success',     true,
        'ledger_id',   v_ledger_id,
        'old_deleted', v_deleted_count,
        'new_balance', p_new_balance,
        'ist_date',    v_today_ist
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- PART 2: One-time historical cleanup — run as a SEPARATE query after Part 1
--
-- Plain SQL DELETE (no variables, no parameters) — eliminates all
-- RESET/DAY_OPENING_BALANCE entries except the most recent per rider.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DELETE FROM public.wallet_ledger
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY rider_id
                   ORDER BY created_at DESC
               ) AS rn
        FROM public.wallet_ledger
        WHERE mode             = 'RESET'
          AND transaction_type = 'DAY_OPENING_BALANCE'
    ) ranked
    WHERE rn > 1
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION — run after both parts. Expected: 0 rows returned.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SELECT rider_id, COUNT(*) AS reset_count
-- FROM public.wallet_ledger
-- WHERE mode = 'RESET' AND transaction_type = 'DAY_OPENING_BALANCE'
-- GROUP BY rider_id
-- HAVING COUNT(*) > 1;
-- Expected: 0 rows returned.
