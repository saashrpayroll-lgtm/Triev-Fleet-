-- ════════════════════════════════════════════════════════════════════════════
-- TL RISK & WALLET MATRIX DASHBOARD SETUP
--
-- 1. Adds exclusion flags to riders table (is_stolen, is_company_tagged).
-- 2. Creates matrix_daily_snapshots table for 5-week historical tracking.
-- 3. Creates 11:59 PM IST daily automated snapshot function.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Add exclusion flags to riders table if not exist
ALTER TABLE public.riders 
ADD COLUMN IF NOT EXISTS is_stolen BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_company_tagged BOOLEAN DEFAULT FALSE;

-- 2. Create matrix_daily_snapshots table for 5-week history
CREATE TABLE IF NOT EXISTS public.matrix_daily_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE,
    city_ops_name TEXT,
    rm_name TEXT,
    tl_name TEXT,
    active_riders INTEGER NOT NULL DEFAULT 0,
    negative_count INTEGER NOT NULL DEFAULT 0,
    range_0_250_count INTEGER NOT NULL DEFAULT 0,
    negative_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    range_0_250_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_daily_tl_snapshot UNIQUE (snapshot_date, city_ops_name, rm_name, tl_name)
);

-- Enable RLS
ALTER TABLE public.matrix_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies for authenticated users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'matrix_daily_snapshots' AND policyname = 'Allow read matrix_daily_snapshots'
    ) THEN
        CREATE POLICY "Allow read matrix_daily_snapshots" ON public.matrix_daily_snapshots
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'matrix_daily_snapshots' AND policyname = 'Allow write matrix_daily_snapshots'
    ) THEN
        CREATE POLICY "Allow write matrix_daily_snapshots" ON public.matrix_daily_snapshots
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Stored Procedure for 11:59 PM IST Automated Daily Snapshot Capture
CREATE OR REPLACE FUNCTION public.capture_daily_matrix_snapshot()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
    -- Delete any partial snapshot for today to ensure clean idempotent insert
    DELETE FROM public.matrix_daily_snapshots WHERE snapshot_date = v_today;

    -- Aggregate active riders per City Ops / RM / TL grouping
    -- Excluding <= 24h new allotments, stolen vehicles, and company tagged riders
    INSERT INTO public.matrix_daily_snapshots (
        snapshot_date,
        city_ops_name,
        rm_name,
        tl_name,
        active_riders,
        negative_count,
        range_0_250_count,
        negative_pct,
        range_0_250_pct
    )
    SELECT
        v_today AS snapshot_date,
        COALESCE(r.skip_manager, 'Unassigned') AS city_ops_name,
        COALESCE(r.reporting_manager, 'Unassigned') AS rm_name,
        COALESCE(r.team_leader, 'Unassigned') AS tl_name,
        COUNT(*)::INTEGER AS active_riders,
        COUNT(CASE WHEN r.wallet_balance < 0 THEN 1 END)::INTEGER AS negative_count,
        COUNT(CASE WHEN r.wallet_balance >= -250 AND r.wallet_balance < 0 THEN 1 END)::INTEGER AS range_0_250_count,
        ROUND(
            (COUNT(CASE WHEN r.wallet_balance < 0 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100, 2
        ) AS negative_pct,
        ROUND(
            (COUNT(CASE WHEN r.wallet_balance >= -250 AND r.wallet_balance < 0 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100, 2
        ) AS range_0_250_pct
    FROM public.riders r
    WHERE r.status = 'active'
      AND COALESCE(r.is_stolen, false) = false
      AND COALESCE(r.is_company_tagged, false) = false
      AND (r.allotment_date IS NULL OR (r.allotment_date AT TIME ZONE 'Asia/Kolkata')::DATE < v_today)
    GROUP BY
        COALESCE(r.skip_manager, 'Unassigned'),
        COALESCE(r.reporting_manager, 'Unassigned'),
        COALESCE(r.team_leader, 'Unassigned');

END;
$$;
