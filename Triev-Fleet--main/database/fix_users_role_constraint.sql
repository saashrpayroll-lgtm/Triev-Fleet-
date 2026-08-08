-- FIX: Update users table role check constraint to include 'reportingManager'
-- Run this in your Supabase SQL Editor

BEGIN;

-- 1. Drop existing role constraints
-- The exact constraint name might be users_role_check or similar. 
-- We gracefully drop it if it exists.
DO $$
DECLARE
    conname text;
BEGIN
    FOR conname IN 
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public' 
          AND rel.relname = 'users'
          AND con.contype = 'c' 
          AND pg_get_constraintdef(con.oid) ILIKE '%role%'
    LOOP
        EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT ' || quote_ident(conname);
    END LOOP;
END
$$;

-- 2. Add the updated constraint with all valid role values
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'teamLeader', 'reportingManager'));

COMMIT;
