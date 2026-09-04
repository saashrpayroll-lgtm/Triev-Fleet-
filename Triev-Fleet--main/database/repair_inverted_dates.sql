-- ════════════════════════════════════════════════════════════════════════════
-- DATABASE SCRIPT: Repair Inverted Month/Day Dates in public.riders
-- ════════════════════════════════════════════════════════════════════════════
-- Problem: Google Sheets / Forms exports dates in M/D/YYYY format (e.g. 9/3/2026 = 3rd Sept 2026).
-- Previous parser incorrectly treated it as DD/MM/YYYY (Day 9, Month 3 = 9th March 2026).
--
-- This script fixes any riders whose allotment_date was inverted:
-- e.g. Created in September (month 9), but allotment_date day is 9 and month is 1..12 (e.g. March 9).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Preview affected rows before updating
-- SELECT id, triev_id, rider_name, allotment_date, created_at
-- FROM public.riders
-- WHERE EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata') = 9
--   AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata') = 2026
--   AND EXTRACT(DAY FROM allotment_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata') = 9
--   AND EXTRACT(MONTH FROM allotment_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata') != 9
--   AND EXTRACT(MONTH FROM allotment_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata') <= 12;

-- 2. Correct inverted allotment_date (swap month and day back to September)
UPDATE public.riders
SET allotment_date = make_timestamptz(
    EXTRACT(YEAR FROM allotment_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::INT,
    EXTRACT(DAY FROM allotment_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::INT,   -- 9 (September)
    EXTRACT(MONTH FROM allotment_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::INT, -- Correct day (e.g. 3)
    12, 0, 0, 'Asia/Kolkata'
)
WHERE EXTRACT(MONTH FROM created_at AT TIME ZONE 'Asia/Kolkata') = 9
  AND EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Kolkata') = 2026
  AND EXTRACT(DAY FROM allotment_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata') = 9
  AND EXTRACT(MONTH FROM allotment_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata') != 9
  AND EXTRACT(MONTH FROM allotment_date::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata') <= 12;

-- 3. Reset any allotment_date accidentally pushed into the future
UPDATE public.riders
SET allotment_date = created_at
WHERE allotment_date::TIMESTAMPTZ > (NOW() AT TIME ZONE 'Asia/Kolkata');

COMMIT;
