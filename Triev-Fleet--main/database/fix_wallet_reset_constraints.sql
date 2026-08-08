-- =========================================================================================
-- FIX: UPDATE CONSTRAINTS FOR INACTIVATION RESET
-- =========================================================================================
-- Run this script to allow the 'INACTIVATION_RESET' type in the wallet_ledger table.
-- =========================================================================================

BEGIN;

-- 1. Update the transaction_type constraint
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;

ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_transaction_type_check 
CHECK (transaction_type IN (
    'DAY_OPENING_BALANCE', 
    'DAILY_COLLECTION', 
    'MANUAL_ADJUSTMENT', 
    'RENT_COLLECTION', 
    'SYSTEM_IMPORT', 
    'BULK_IMPORT',
    'INACTIVATION_RESET' -- <--- Added this to allow the new feature
));

COMMIT;
