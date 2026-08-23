-- ============================================================================
-- SUPABASE EGRESS & REALTIME OPTIMIZATION SCRIPT
-- Purpose: Stop excessive PostgreSQL Realtime WAL streaming and optimize indexes
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- 1. DROP HIGH-FREQUENCY WRITE TABLES FROM REALTIME PUBLICATION
-- Subscribing to heavy tables (riders, wallet_ledger, daily_collections, leads) 
-- broadcasts tens of thousands of JSON payloads over WebSockets, consuming GBs of Egress.

DO $$
BEGIN
    -- Remove wallet_ledger from realtime
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'wallet_ledger'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE wallet_ledger;
    END IF;

    -- Remove daily_collections from realtime
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'daily_collections'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE daily_collections;
    END IF;

    -- Remove riders from realtime
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'riders'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE riders;
    END IF;

    -- Remove leads from realtime
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE leads;
    END IF;
END $$;

-- 2. ENSURE LIGHTWEIGHT USER-FACING TABLES RETAIN REALTIME
-- These are low-frequency, event-driven tables essential for instant UI alerts:
DO $$
BEGIN
    -- announcements (Admin broadcast alerts)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'announcements') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
        END IF;
    END IF;

    -- notifications (User personal notifications)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        END IF;
    END IF;

    -- requests (Approval request badges)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'requests') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'requests') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE requests;
        END IF;
    END IF;

    -- system_settings (Global settings sync)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_settings') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'system_settings') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
        END IF;
    END IF;
END $$;

-- 3. CREATE COMPOSITE INDEXES FOR HIGH-TRAFFIC FILTER QUERIES
-- Reduces query scan time and CPU egress overhead:

CREATE INDEX IF NOT EXISTS idx_daily_collections_tl_date 
ON public.daily_collections (team_leader_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_opt_lookup 
ON public.wallet_ledger (mode, transaction_type, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_riders_tl_status_wallet 
ON public.riders (team_leader_id, status, wallet_amount);

CREATE INDEX IF NOT EXISTS idx_leads_creator_status 
ON public.leads (created_by, status, created_at DESC);

-- 4. VERIFY ACTIVE REALTIME TABLES
SELECT tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
ORDER BY tablename;
