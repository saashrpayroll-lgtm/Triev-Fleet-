-- SMART RECONCILIATION VIEW (FIXED - EXCLUDES AUTO-FIXES)
-- Prevents "Infinite Increase" loop by ignoring Auto-Reconciliation txns in Expected Balance.

DROP VIEW IF EXISTS public.view_reconciliation_status CASCADE;

CREATE OR REPLACE VIEW public.view_reconciliation_status AS
WITH latest_snapshots AS (
    SELECT DISTINCT ON (rider_id) 
        rider_id, 
        snapshot_balance, 
        snapshot_date,
        created_at
    FROM public.wallet_snapshots
    ORDER BY rider_id, snapshot_date DESC, created_at DESC
),
ledger_movements AS (
    SELECT 
        wl.rider_id,
        SUM(
            CASE 
                WHEN wl.mode = 'ADD' THEN wl.amount 
                WHEN wl.mode = 'SUBTRACT' THEN -wl.amount 
                ELSE 0 
            END
        ) AS movement_since_snapshot
    FROM public.wallet_ledger wl
    JOIN latest_snapshots ls ON wl.rider_id = ls.rider_id
    WHERE wl.created_at > ls.created_at -- Only transactions AFTER the snapshot
      AND (wl.metadata->>'reconciled_from_snapshot') IS DISTINCT FROM 'true' -- <--- CRITICAL FIX: Ignore Auto-Fixes
    GROUP BY wl.rider_id
)
SELECT 
    r.id AS rider_id,
    r.rider_name,
    r.triev_id,
    r.mobile_number,
    r.team_leader_id,
    r.wallet_amount AS system_balance,
    ls.snapshot_balance AS snapshot_balance,
    COALESCE(lm.movement_since_snapshot, 0) AS authorized_movement,
    (ls.snapshot_balance + COALESCE(lm.movement_since_snapshot, 0)) AS expected_balance,
    ls.snapshot_date,
    -- Difference = Expected - System
    -- If 0, it means the system balance is exactly what it should be (Snapshot + Transactions).
    ((ls.snapshot_balance + COALESCE(lm.movement_since_snapshot, 0)) - r.wallet_amount) AS difference
FROM public.riders r
JOIN latest_snapshots ls ON r.id = ls.rider_id
LEFT JOIN ledger_movements lm ON r.id = lm.rider_id
WHERE ABS((ls.snapshot_balance + COALESCE(lm.movement_since_snapshot, 0)) - r.wallet_amount) > 1; -- Threshold of 1 Rupee

-- Grant access
GRANT SELECT ON public.view_reconciliation_status TO authenticated;
