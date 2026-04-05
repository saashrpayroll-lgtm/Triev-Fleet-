-- SQL Script to sync existing hierarchy to the new city_ops_id columns
-- Run this in Supabase SQL Editor

-- 1. Update RMs: Find the City Ops user whose name matches the RM's reporting_manager field
UPDATE public.users rm
SET city_ops_id = co.id::text
FROM public.users co
WHERE rm.role = 'reportingManager'
AND rm.reporting_manager = co.full_name
AND co.role = 'cityOps'
AND (rm.city_ops_id IS NULL OR rm.city_ops_id = '');

-- 2. Update TLs: Set city_ops_id to the city_ops_id of their Reporting Manager (RM)
-- A TL can report to an RM (who now has a city_ops_id)
UPDATE public.users tl
SET city_ops_id = rm.city_ops_id
FROM public.users rm
WHERE tl.role = 'teamLeader'
AND tl.reporting_manager = rm.full_name
AND (tl.city_ops_id IS NULL OR tl.city_ops_id = '')
AND rm.city_ops_id IS NOT NULL;

-- 3. Update Riders: Set city_ops_id to the city_ops_id of their Team Leader (TL)
UPDATE public.riders r
SET city_ops_id = tl.city_ops_id
FROM public.users tl
WHERE r.team_leader_id = tl.id
AND r.city_ops_id IS NULL
AND tl.city_ops_id IS NOT NULL;

-- 4. Verify results
SELECT role, COUNT(*) as count, COUNT(city_ops_id) as scoped_count
FROM public.users
GROUP BY role;
