-- ═══════════════════════════════════════════════════════════════════════════════
-- DATA CORRECTION: Fix Day/Month swapped dates in Wallet Ledger (Jan 3rd -> Mar 1st)
-- Run this in Supabase SQL editor to fix the corrupted imported data for March 1st.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Identify and fix incorrectly parsing dates
-- Since March 1st was imported as DD/MM/YYYY '01/03/2026', Javascript parsed it
-- as January 3rd '2026-01-03T...'. We need to identify these exact imports
-- that happened around March 1st real time.

WITH bad_imports AS (
    SELECT id
    FROM public.wallet_ledger 
    -- Check for January 3rd metadata
    WHERE metadata->>'date_on_sheet' LIKE '2026-01-03T%'
      -- Ensure these were actually created recently (March 1st onwards)
      AND created_at >= '2026-03-01'
)
UPDATE public.wallet_ledger
SET 
    transaction_date = '2026-03-01 00:00:00+05:30'::TIMESTAMPTZ,
    metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb), 
        '{date_on_sheet}', 
        '"2026-03-01T00:00:00.000Z"'::jsonb
    )
WHERE id IN (SELECT id FROM bad_imports);

-- 2. Trigger a full recalculation to instantly reflect the fixed dates
-- across all TL performance and admin dashboards.
SELECT public.resync_all_daily_collections();

COMMIT;
