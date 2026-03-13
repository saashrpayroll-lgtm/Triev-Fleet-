-- Migration: Add 'position' column to users table
-- Run this in your Supabase SQL Editor

-- 1. Add the column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS position TEXT;

-- 2. Migrate existing position data from remarks field
-- (Previously position was appended to remarks as "[Position: XYZ]")
UPDATE public.users
SET
    position = TRIM(SUBSTRING(remarks FROM '\\[Position: (.+?)\\]')),
    remarks = TRIM(REGEXP_REPLACE(remarks, E'\\n?\\[Position: .+?\\]', '', 'g'))
WHERE remarks LIKE '%[Position:%]%';

-- 3. Enable realtime for the position column (already enabled for the table)
-- No action needed — Supabase realtime picks up all column changes for subscribed tables.

SELECT 'Migration complete. Position column added and data migrated.' AS result;
