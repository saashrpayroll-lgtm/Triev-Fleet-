-- =========================================================================================
-- SYNC: RESET EXISTING INACTIVE RIDER WALLETS
-- =========================================================================================
-- Use this script to catch-up and reset wallets to 0 for riders who were ALREADY 
-- inactive before the automation trigger was installed.
-- =========================================================================================

BEGIN;

-- 0. Update the transaction_type constraint first
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_transaction_type_check 
CHECK (transaction_type IN (
    'DAY_OPENING_BALANCE', 'DAILY_COLLECTION', 'MANUAL_ADJUSTMENT', 
    'RENT_COLLECTION', 'SYSTEM_IMPORT', 'BULK_IMPORT', 'INACTIVATION_RESET'
));

-- 1. Insert RESET transactions for all currently inactive riders who are NOT at 0
-- We do this even if an 'INACTIVATION_RESET' exists, to override any newer negative baselines.
INSERT INTO public.wallet_ledger (
    rider_id,
    transaction_type,
    mode,
    amount,
    description,
    source_type,
    transaction_date,
    metadata
)
SELECT 
    r.id,
    'INACTIVATION_RESET',
    'RESET',
    0,
    'Forced Sync: Resetting inactive rider wallet back to 0 (Overriding newer updates)',
    'SYSTEM',
    NOW(),
    '{"action": "forced_sync_reset"}'::jsonb
FROM public.riders r
WHERE r.status = 'inactive'
  AND r.wallet_amount != 0; -- Target ONLY those who reverted to negative/positive

-- 2. Update the cached wallet_amount in riders table
-- This calls the logic that sums up the latest RESET + subsequent transactions
UPDATE public.riders
SET wallet_amount = public.calculate_rider_balance(id),
    updated_at = NOW()
WHERE status = 'inactive';

COMMIT;
