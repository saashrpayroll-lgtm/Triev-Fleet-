-- FORCE SYNC ALL RIDERS
-- Objective: Recalculate the wallet balance for EVERY rider using the fixed logic.
-- This ensures that any rider with a "History Sum" error gets corrected to "Reset + Add".

DO $$
DECLARE
    r RECORD;
    v_count INT := 0;
BEGIN
    RAISE NOTICE 'Starting Bulk Wallet Sync...';

    FOR r IN SELECT id, mobile_number FROM public.riders LOOP
        -- Call the (now fixed) calculation function and update the riders table
        PERFORM public.sync_wallet_balance_for_rider(r.id);
        v_count := v_count + 1;
    END LOOP;

    RAISE NOTICE 'Successfully synced % riders.', v_count;
END $$;
