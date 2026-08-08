-- Create table for storing daily aggregated collections per Team Leader
CREATE TABLE IF NOT EXISTS public.daily_collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_leader_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_collection NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure one record per TL per day
    UNIQUE(team_leader_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_collections ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admins can do everything on daily_collections" ON public.daily_collections;
CREATE POLICY "Admins can do everything on daily_collections"
    ON public.daily_collections
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Team Leaders can view their own collections" ON public.daily_collections;
CREATE POLICY "Team Leaders can view their own collections"
    ON public.daily_collections
    FOR SELECT
    USING (
        auth.uid() = team_leader_id
    );
