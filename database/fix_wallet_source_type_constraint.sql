-- ════════════════════════════════════════════════════════════════════════════
-- FIX: wallet_ledger_source_type_check Constraint Violation
--      Bulk Wallet Update was failing because handle_daily_wallet_update
--      inserts source_type = 'RESET' but the constraint only allows
--      ('SYSTEM', 'IMPORT', 'MANUAL').
--
-- HOW TO RUN: Paste entire script in Supabase SQL Editor and execute.
-- ════════════════════════════════════════════════════════════════════════════

-- STEP 1: Expand the source_type CHECK constraint to include 'RESET'
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_source_type_check;
ALTER TABLE public.wallet_ledger
    ADD CONSTRAINT wallet_ledger_source_type_check
    CHECK (source_type IN ('SYSTEM', 'IMPORT', 'MANUAL', 'RESET'));

-- STEP 2: Re-create handle_daily_wallet_update with the correct source_type
--         (Uses 'RESET' which is now allowed by the updated constraint above)
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
    DELETE FROM public.wallet_ledger wl
    WHERE wl.rider_id         = p_rider_id
      AND wl.mode             = 'RESET'
      AND wl.transaction_type = 'DAY_OPENING_BALANCE'
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
        'RESET'   -- ✅ Now allowed by the updated source_type constraint above
    )
    ON CONFLICT (external_transaction_id)
    DO UPDATE SET
        amount     = EXCLUDED.amount,
        metadata   = EXCLUDED.metadata,
        created_at = NOW()
    RETURNING id INTO v_ledger_id;

    -- 4. Sync riders.wallet_amount directly
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

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run after the above to confirm constraint is correct)
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT conname, consrc
-- FROM pg_constraint
-- WHERE conname = 'wallet_ledger_source_type_check';
-- Expected: source_type IN ('SYSTEM','IMPORT','MANUAL','RESET')
