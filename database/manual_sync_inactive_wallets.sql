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

-- 1. Insert RESET transactions for all currently inactive riders
-- We only do this for riders who don't already have an 'INACTIVATION_RESET'
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
    'Manual catch-up: Resetting existing inactive rider wallet to 0',
    'SYSTEM',
    NOW(),
    '{"action": "manual_sync_reset"}'::jsonb
FROM public.riders r
WHERE r.status = 'inactive'
  AND NOT EXISTS (
      SELECT 1 FROM public.wallet_ledger wl 
      WHERE wl.rider_id = r.id 
        AND wl.transaction_type = 'INACTIVATION_RESET'
  );

-- 2. Update the cached wallet_amount in riders table
-- This calls the logic that sums up the latest RESET + subsequent transactions
UPDATE public.riders
SET wallet_amount = public.calculate_rider_balance(id),
    updated_at = NOW()
WHERE status = 'inactive';

COMMIT;
