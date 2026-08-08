// add_gamification_columns.sql
-- Add gamification column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS target_amount NUMERIC DEFAULT 0;

-- Optional: Add a badges array to optionally lock in badges manually in the future
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS awarded_badges TEXT[] DEFAULT '{}';
