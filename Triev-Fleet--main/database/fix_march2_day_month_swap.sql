-- ═══════════════════════════════════════════════════════════════════════════════
-- DATA CORRECTION: Fix Day/Month swapped dates in Wallet Ledger (Feb 3rd -> Mar 2nd)
-- Run this in Supabase SQL editor to fix the corrupted imported data.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Identify and fix incorrectly parsing dates
-- Since March 2nd was imported as DD/MM/YYYY '02/03/2026', Javascript parsed it
-- as February 3rd '2026-02-03T...'. We need to identify these exact imports
-- that happened ON or AFTER March 1st real time.

WITH bad_imports AS (
    SELECT id
    FROM public.wallet_ledger 
    WHERE metadata->>'source' = 'rent_import'
      AND metadata->>'date_on_sheet' LIKE '2026-02-03T%'
      AND created_at >= '2026-03-01'
)
UPDATE public.wallet_ledger
SET 
    transaction_date = '2026-03-02 00:00:00+05:30'::TIMESTAMPTZ,
    metadata = jsonb_set(
        metadata, 
        '{date_on_sheet}', 
        '"2026-03-02T00:00:00.000Z"'::jsonb
    )
WHERE id IN (SELECT id FROM bad_imports);

-- 2. Trigger a full recalculation to instantly reflect the fixed dates
-- across all TL performance and admin dashboards.
SELECT public.resync_all_daily_collections();

COMMIT;
