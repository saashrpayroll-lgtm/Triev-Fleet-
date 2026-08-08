-- 🔔 IMPORTANT: Run this in your Supabase SQL Editor to enable Popups!

BEGIN;

DO $$
BEGIN
    -- 1. Enable Realtime for 'announcements' (Broadcasts)
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'announcements') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
    END IF;

    -- 2. Enable Realtime for 'notifications' (Individual alerts)
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

COMMIT;
