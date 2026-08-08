-- ═══════════════════════════════════════════════════════════════════════════════
-- DATA CORRECTION: Fix last lingering errant date for Aftab (Feb 3rd -> Mar 2nd)
-- Run this in Supabase SQL editor to fix the final ₹300 mismatch
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE public.wallet_ledger
SET 
    transaction_date = '2026-03-02 00:00:00+05:30'::TIMESTAMPTZ,
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb), 
        '{date_on_sheet}', 
        '"2026-03-02T00:00:00.000Z"'::jsonb
    )
WHERE mode = 'ADD' 
  AND transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
  AND created_at >= '2026-03-02'
  AND metadata->>'source' = 'rent_import'
  AND metadata->>'date_on_sheet' LIKE '2026-02-02T%';

-- Trigger recalculation to pull that 300 rupees into March 2nd
SELECT public.resync_all_daily_collections();

COMMIT;
