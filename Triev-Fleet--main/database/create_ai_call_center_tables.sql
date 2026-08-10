-- Migration for AI Call Center (ElevenLabs + n8n Integration)
-- Tables: ai_call_logs & auto_call_config

CREATE TABLE IF NOT EXISTS public.ai_call_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_id TEXT NOT NULL,
    rider_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    call_scenario TEXT NOT NULL,
    triggered_by TEXT,
    triggered_by_name TEXT,
    call_id TEXT UNIQUE,
    status TEXT DEFAULT 'initiated',
    wallet_amount_at_call NUMERIC DEFAULT 0,
    duration INTEGER DEFAULT 0,
    transcript TEXT,
    summary TEXT,
    recording_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auto_call_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_leader_id TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    negative_balance_threshold NUMERIC DEFAULT 0,
    low_balance_threshold NUMERIC DEFAULT 250,
    max_calls_per_day NUMERIC DEFAULT 20,
    call_time_start TEXT DEFAULT '10:00',
    call_time_end TEXT DEFAULT '18:00',
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add full access policies for app & n8n webhook
ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_call_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all select on ai_call_logs" ON public.ai_call_logs;
DROP POLICY IF EXISTS "Allow all insert on ai_call_logs" ON public.ai_call_logs;
DROP POLICY IF EXISTS "Allow all update on ai_call_logs" ON public.ai_call_logs;
DROP POLICY IF EXISTS "Allow all delete on ai_call_logs" ON public.ai_call_logs;

CREATE POLICY "Allow all select on ai_call_logs" ON public.ai_call_logs FOR SELECT USING (true);
CREATE POLICY "Allow all insert on ai_call_logs" ON public.ai_call_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on ai_call_logs" ON public.ai_call_logs FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on ai_call_logs" ON public.ai_call_logs FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow all select on auto_call_config" ON public.auto_call_config;
DROP POLICY IF EXISTS "Allow all insert on auto_call_config" ON public.auto_call_config;
DROP POLICY IF EXISTS "Allow all update on auto_call_config" ON public.auto_call_config;

CREATE POLICY "Allow all select on auto_call_config" ON public.auto_call_config FOR SELECT USING (true);
CREATE POLICY "Allow all insert on auto_call_config" ON public.auto_call_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on auto_call_config" ON public.auto_call_config FOR UPDATE USING (true);
