-- ════════════════════════════════════════════════════════════════════════════
-- EMERGENCY CLEANUP: Remove spurious future-date entries (03 Apr / April 3)
-- ════════════════════════════════════════════════════════════════════════════
-- Run this FIRST in Supabase SQL Editor to fix the current display issue.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Step 1: Find and show any future-date entries in daily_collections
SELECT team_leader_id, date, total_collection 
FROM public.daily_collections 
WHERE date > (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
ORDER BY date;

-- Step 2: Remove all future-date entries from daily_collections
DELETE FROM public.daily_collections 
WHERE date > (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

-- Step 3: Fix any wallet_ledger entries where transaction_date is in the future
-- (Reset them to created_at)
UPDATE public.wallet_ledger
SET transaction_date = created_at
WHERE transaction_date::DATE > (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;

-- Step 4: Add Server-Side Guard to update_wallet_transaction_date RPC
DROP FUNCTION IF EXISTS public.update_wallet_transaction_date(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.update_wallet_transaction_date(
    p_transaction_id UUID, 
    p_new_date TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
    v_old_date DATE;
    v_new_date DATE;
    v_tl_id UUID;
    v_today DATE;
BEGIN
    -- ╔══════════════════════════════════╗
    -- ║  SERVER-SIDE FUTURE DATE GUARD  ║
    -- ╚══════════════════════════════════╝
    v_today := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_new_date := (p_new_date AT TIME ZONE 'Asia/Kolkata')::DATE;
    
    IF v_new_date > v_today THEN
        RAISE EXCEPTION 'Future date not allowed: % (today is %)', v_new_date, v_today;
    END IF;

    -- Get current date for this transaction
    SELECT public.get_ledger_date_v20(metadata, transaction_date::TIMESTAMPTZ, created_at)
    INTO v_old_date
    FROM public.wallet_ledger
    WHERE id = p_transaction_id;

    -- Update transaction_date
    UPDATE public.wallet_ledger 
    SET transaction_date = p_new_date
    WHERE id = p_transaction_id;

    -- Recalculate for OLD date
    SELECT r.team_leader_id INTO v_tl_id
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE wl.id = p_transaction_id;

    IF v_tl_id IS NOT NULL AND v_old_date IS NOT NULL THEN
        PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_old_date);
    END IF;

    -- Recalculate for NEW date (if different from old)
    IF v_new_date != v_old_date AND v_tl_id IS NOT NULL THEN
        PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_new_date);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Step 5: Add Server-Side Guard to bulk_update_wallet_transaction_date RPC
DROP FUNCTION IF EXISTS public.bulk_update_wallet_transaction_date(UUID[], TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.bulk_update_wallet_transaction_date(
    p_transaction_ids UUID[], 
    p_new_date TIMESTAMPTZ
)
RETURNS VOID AS $$
DECLARE
    v_today DATE;
    v_new_date DATE;
    v_txn_id UUID;
    v_old_date DATE;
    v_tl_id UUID;
BEGIN
    -- ╔══════════════════════════════════╗
    -- ║  SERVER-SIDE FUTURE DATE GUARD  ║
    -- ╚══════════════════════════════════╝
    v_today := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_new_date := (p_new_date AT TIME ZONE 'Asia/Kolkata')::DATE;
    
    IF v_new_date > v_today THEN
        RAISE EXCEPTION 'Future date not allowed: % (today is %)', v_new_date, v_today;
    END IF;

    -- Loop through each transaction and update + recalculate
    FOREACH v_txn_id IN ARRAY p_transaction_ids LOOP
        SELECT public.get_ledger_date_v20(metadata, transaction_date::TIMESTAMPTZ, created_at)
        INTO v_old_date
        FROM public.wallet_ledger WHERE id = v_txn_id;

        UPDATE public.wallet_ledger SET transaction_date = p_new_date WHERE id = v_txn_id;

        SELECT r.team_leader_id INTO v_tl_id
        FROM public.wallet_ledger wl
        JOIN public.riders r ON wl.rider_id = r.id
        WHERE wl.id = v_txn_id;

        IF v_tl_id IS NOT NULL AND v_old_date IS NOT NULL THEN
            PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_old_date);
        END IF;

        IF v_new_date != v_old_date AND v_tl_id IS NOT NULL THEN
            PERFORM public.recalculate_daily_collection_for_date(v_tl_id, v_new_date);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Step 6: Verify cleanup worked
SELECT 'Remaining future entries:' as status, COUNT(*) as count
FROM public.daily_collections 
WHERE date > (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
