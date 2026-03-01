-- ════════════════════════════════════════════════════════════════════════════
-- AUTO-CLEANUP: Old DAY_OPENING_BALANCE / RESET entries on Bulk Wallet Update
-- Run this ENTIRE script in the Supabase SQL Editor AFTER running:
--   fix_collection_ist_and_daily_snapshot.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- WHAT THIS DOES:
-- Patches the `handle_daily_wallet_update` function to automatically DELETE
-- any RESET / DAY_OPENING_BALANCE entries for the same rider that belong to
-- a previous IST date — inside the same transaction as the new entry.
--
-- Result:
--   ✅ Only today's RESET entry survives for each rider
--   ✅ TL panel reflects the cleanup immediately (same table)
--   ✅ All collection/ADD entries are NEVER touched
--   ✅ Zero frontend changes required
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION public.handle_daily_wallet_update(
    p_rider_id  UUID,
    p_new_balance NUMERIC,
    p_date      TIMESTAMPTZ,
    p_external_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today_ist   DATE;
    v_deleted_count INTEGER;
    v_ledger_id   UUID;
BEGIN
    -- ── 1. Resolve "today" in IST ─────────────────────────────────────────
    v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

    -- ── 2. AUTO-CLEANUP: Delete all old-date RESET entries for this rider ──
    --    Keeps ONLY current IST date's RESET entries.
    --    All ADD/SUBTRACT/DAILY_COLLECTION entries are untouched.
    DELETE FROM public.wallet_ledger
    WHERE rider_id          = p_rider_id
      AND mode              = 'RESET'
      AND transaction_type  = 'DAY_OPENING_BALANCE'
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE < v_today_ist;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    -- ── 3. Upsert today's RESET entry (idempotent via external_transaction_id) ──
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
    )
    VALUES (
        p_rider_id,
        p_new_balance,
        'DAY_OPENING_BALANCE',
        'RESET',
        'Daily opening balance set via bulk wallet update',
        jsonb_build_object(
            'source', 'bulk_wallet_update',
            'ist_date', v_today_ist::TEXT,
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

    -- ── 4. Sync riders.wallet_amount ──────────────────────────────────────
    UPDATE public.riders
    SET wallet_amount = p_new_balance,
        updated_at    = NOW()
    WHERE id = p_rider_id;

    RETURN jsonb_build_object(
        'success',          true,
        'ledger_id',        v_ledger_id,
        'old_deleted',      v_deleted_count,
        'new_balance',      p_new_balance,
        'ist_date',         v_today_ist
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error',   SQLERRM
    );
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- OPTIONAL: One-time cleanup of ALL historical RESET entries across ALL riders
-- (Keeps only the most recent RESET per rider)
-- Run this once after deploying the function above.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO $$
DECLARE
    v_deleted INTEGER;
BEGIN
    -- Delete all RESET/DAY_OPENING_BALANCE entries that are NOT
    -- the latest one per rider (keeps the newest per rider).
    WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY rider_id
                   ORDER BY created_at DESC
               ) AS rn
        FROM public.wallet_ledger
        WHERE mode             = 'RESET'
          AND transaction_type = 'DAY_OPENING_BALANCE'
    )
    DELETE FROM public.wallet_ledger
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'One-time cleanup: deleted % old RESET entries', v_deleted;
END;
$$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VERIFICATION (run separately after the above)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Check: each rider should have at most 1 RESET entry now.
-- SELECT rider_id, COUNT(*) AS reset_count
-- FROM wallet_ledger
-- WHERE mode = 'RESET' AND transaction_type = 'DAY_OPENING_BALANCE'
-- GROUP BY rider_id
-- HAVING COUNT(*) > 1;
-- Expected: 0 rows returned.
