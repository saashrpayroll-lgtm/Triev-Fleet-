-- ════════════════════════════════════════════════════════════════════════════
-- PERMANENT DATABASE REPAIR: Fix Corrupted Allotment Dates in public.riders
-- ════════════════════════════════════════════════════════════════════════════
-- Copy and run this script in Supabase SQL Editor to clean up DB records.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Reset allotment_date to created_at for any rider whose allotment_date is in the future
UPDATE public.riders
SET allotment_date = created_at
WHERE allotment_date::TIMESTAMPTZ > (NOW() AT TIME ZONE 'Asia/Kolkata');

-- 2. Reset allotment_date to created_at for any rider whose allotment_date is later than created_at
UPDATE public.riders
SET allotment_date = created_at
WHERE allotment_date::TIMESTAMPTZ > (created_at + INTERVAL '1 day');

COMMIT;

-- Verification Query: Show any remaining anomalies (should return 0 rows)
SELECT id, triev_id, rider_name, allotment_date, created_at
FROM public.riders
WHERE allotment_date::TIMESTAMPTZ > (NOW() AT TIME ZONE 'Asia/Kolkata')
   OR allotment_date::TIMESTAMPTZ > (created_at + INTERVAL '1 day');

