-- FIX: Update users table status check constraint to include 'inactive'
-- Run this in your Supabase SQL Editor

BEGIN;

-- 1. Drop the existing constraint if it exists
-- The error message specified "users_status_check"
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;

-- 2. Add the updated constraint with all valid status values
ALTER TABLE public.users ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'inactive', 'suspended', 'deleted'));

-- 3. Ensure no NULL status values (safety check)
UPDATE public.users SET status = 'active' WHERE status IS NULL;

COMMIT;
