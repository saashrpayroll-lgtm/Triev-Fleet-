-- City Ops Role: Database Migration
-- Run this in Supabase SQL Editor

-- 1. Add city_ops_id to users table (links RM/TL to their City Ops head)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city_ops_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_city_ops_id ON public.users(city_ops_id);

-- 2. Add city_ops_id to riders table (for fast data scoping queries)
ALTER TABLE public.riders ADD COLUMN IF NOT EXISTS city_ops_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_riders_city_ops_id ON public.riders(city_ops_id);

-- 3. Comment for clarity
COMMENT ON COLUMN public.users.city_ops_id IS 'Links RM/TL to their City Ops supervisor for hierarchical data scoping';
COMMENT ON COLUMN public.riders.city_ops_id IS 'Links rider to their City Ops head for fast filtered queries';
