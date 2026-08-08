-- Migration: Setup User Presence for Admin Live Monitoring

-- 1. Create the user_presence table
CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id UUID PRIMARY KEY,
    email TEXT,
    role TEXT,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'idle', 'offline')),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add RLS Policies
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Everyone can view presence (needed for Admins, but also users might see if TL is online)
CREATE POLICY "Anyone can view presence" 
    ON public.user_presence FOR SELECT 
    USING (true);

-- Users can only update their own presence
CREATE POLICY "Users can update their own presence" 
    ON public.user_presence FOR ALL 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Add function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_user_presence_updated_at
    BEFORE UPDATE ON public.user_presence
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- 4. Create an RPC function to neatly set presence (upsert)
CREATE OR REPLACE FUNCTION public.upsert_user_presence(
    p_user_id UUID,
    p_email TEXT,
    p_role TEXT,
    p_status TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_presence (user_id, email, role, status, last_seen_at)
    VALUES (p_user_id, p_email, p_role, p_status, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        last_seen_at = now(),
        -- Only update email/role if they are provided to avoid blanking them out
        email = COALESCE(EXCLUDED.email, user_presence.email),
        role = COALESCE(EXCLUDED.role, user_presence.role);
END;
$$;
