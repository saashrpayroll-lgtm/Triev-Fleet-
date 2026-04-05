-- SQL Script to sync existing hierarchy to the new city_ops_id columns
-- Run this in Supabase SQL Editor ONCE to backfill all existing records.
-- Safe to re-run: all statements use conditional checks.

-- ─── Step 1: Update RMs ──────────────────────────────────────────────────────
-- Find the City Ops user whose full_name matches the RM's reporting_manager field.
UPDATE public.users rm
SET city_ops_id = co.id::text
FROM public.users co
WHERE rm.role = 'reportingManager'
  AND rm.reporting_manager = co.full_name
  AND co.role = 'cityOps'
  AND (rm.city_ops_id IS NULL OR rm.city_ops_id = '');

-- ─── Step 2: Update TLs via their RM's city_ops_id ───────────────────────────
-- A TL reporting to an RM inherits the RM's city_ops_id.
UPDATE public.users tl
SET city_ops_id = rm.city_ops_id
FROM public.users rm
WHERE tl.role = 'teamLeader'
  AND tl.reporting_manager = rm.full_name
  AND rm.role = 'reportingManager'
  AND (tl.city_ops_id IS NULL OR tl.city_ops_id = '')
  AND rm.city_ops_id IS NOT NULL
  AND rm.city_ops_id <> '';

-- ─── Step 3: Update TLs who report DIRECTLY to City Ops ─────────────────────
-- Some TLs may report directly to City Ops (no RM in between).
UPDATE public.users tl
SET city_ops_id = co.id::text
FROM public.users co
WHERE tl.role = 'teamLeader'
  AND tl.reporting_manager = co.full_name
  AND co.role = 'cityOps'
  AND (tl.city_ops_id IS NULL OR tl.city_ops_id = '');

-- ─── Step 4: Update Riders via their TL's city_ops_id ───────────────────────
-- Each rider inherits city_ops_id from their assigned Team Leader.
UPDATE public.riders r
SET city_ops_id = tl.city_ops_id
FROM public.users tl
WHERE r.team_leader_id = tl.id
  AND (r.city_ops_id IS NULL OR r.city_ops_id = '')
  AND tl.city_ops_id IS NOT NULL
  AND tl.city_ops_id <> '';

-- ─── Verify results ───────────────────────────────────────────────────────────
SELECT
  role,
  COUNT(*) AS total,
  COUNT(CASE WHEN city_ops_id IS NOT NULL AND city_ops_id <> '' THEN 1 END) AS scoped_count,
  COUNT(CASE WHEN city_ops_id IS NULL OR city_ops_id = '' THEN 1 END) AS unscoped_count
FROM public.users
GROUP BY role
ORDER BY role;

-- Also check rider coverage:
SELECT
  COUNT(*) AS total_riders,
  COUNT(CASE WHEN city_ops_id IS NOT NULL AND city_ops_id <> '' THEN 1 END) AS scoped_riders,
  COUNT(CASE WHEN city_ops_id IS NULL OR city_ops_id = '' THEN 1 END) AS unscoped_riders
FROM public.riders;

