-- ════════════════════════════════════════════════════════════════════════════
-- BACKGROUND LIVE GOOGLE SHEET SYNC SETUP
--
-- This script ensures system_settings table exists and initializes keys for
-- 24/7 background Live Google Sheet Sync & distributed lock tracking.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Ensure system_settings table exists
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS if not enabled
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 2. Allow authenticated users and service role to select/update system_settings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'Allow read for authenticated users'
    ) THEN
        CREATE POLICY "Allow read for authenticated users" ON public.system_settings
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'Allow write for authenticated users'
    ) THEN
        CREATE POLICY "Allow write for authenticated users" ON public.system_settings
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Initialize default sync status if missing
INSERT INTO public.system_settings (key, value, updated_at)
VALUES (
    'last_sheet_sync_status',
    jsonb_build_object(
        'lastSyncTime', null,
        'status', 'idle',
        'syncError', null,
        'scannedCount', 0,
        'lastSummary', null,
        'lockedUntil', null
    ),
    NOW()
)
ON CONFLICT (key) DO NOTHING;
