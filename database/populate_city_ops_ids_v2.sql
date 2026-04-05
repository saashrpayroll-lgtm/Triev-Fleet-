-- city_ops_hierarchy_sync_v2.sql
-- Run this in Supabase SQL Editor to populate city_ops_id across all tables

BEGIN;

-- 1. Update Reporting Managers (RMs)
-- Find the City Ops user whose name matches the RM's reporting_manager field
UPDATE public.users rm
SET city_ops_id = co.id::text
FROM public.users co
WHERE rm.role = 'reportingManager'
AND rm.reporting_manager = co.full_name
AND co.role = 'cityOps'
AND (rm.city_ops_id IS NULL OR rm.city_ops_id = '');

-- 2. Update Team Leaders (TLs)
-- A TL can report to an RM (who now has a city_ops_id) OR directly to a City Ops user
WITH tl_updates AS (
    SELECT 
        tl.id, 
        COALESCE(rm.city_ops_id, co.id::text) as new_city_ops_id
    FROM public.users tl
    LEFT JOIN public.users rm ON tl.reporting_manager = rm.full_name AND rm.role = 'reportingManager'
    LEFT JOIN public.users co ON tl.reporting_manager = co.full_name AND co.role = 'cityOps'
    WHERE tl.role = 'teamLeader'
    AND (tl.city_ops_id IS NULL OR tl.city_ops_id = '')
)
UPDATE public.users tl
SET city_ops_id = u.new_city_ops_id
FROM tl_updates u
WHERE tl.id = u.id
AND u.new_city_ops_id IS NOT NULL;

-- 3. Update Riders
-- Link riders to City Ops via their Team Leader
UPDATE public.riders r
SET city_ops_id = tl.city_ops_id
FROM public.users tl
WHERE r.team_leader_id = tl.id
AND tl.role = 'teamLeader'
AND (r.city_ops_id IS NULL OR r.city_ops_id = '')
AND tl.city_ops_id IS NOT NULL;

-- 4. Count Verification
SELECT 
    role, 
    COUNT(*) as total_count, 
    COUNT(city_ops_id) as scoped_to_city_ops
FROM public.users
GROUP BY role;

COMMIT;
