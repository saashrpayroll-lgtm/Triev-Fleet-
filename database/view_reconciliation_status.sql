-- Reconciliation View
-- Efficiently fetches riders with wallet mismatches (System vs Snapshot)

CREATE OR REPLACE VIEW public.view_reconciliation_status AS
WITH latest_snapshots AS (
    SELECT DISTINCT ON (rider_id) 
        rider_id, 
        snapshot_balance, 
        snapshot_date,
        created_at
    FROM public.wallet_snapshots
    ORDER BY rider_id, snapshot_date DESC, created_at DESC
)
SELECT 
    r.id AS rider_id,
    r.rider_name,
    r.triev_id,
    r.mobile_number,
    r.team_leader_id,
    r.wallet_amount AS system_balance,
    ls.snapshot_balance AS snapshot_balance,
    ls.snapshot_date,
    (ls.snapshot_balance - r.wallet_amount) AS difference -- Positive Diff = Snapshot is higher (Sys needs Credit)
FROM public.riders r
JOIN latest_snapshots ls ON r.id = ls.rider_id
WHERE ABS(ls.snapshot_balance - r.wallet_amount) > 1; -- Threshold of 1 Rupee

-- Grant access
GRANT SELECT ON public.view_reconciliation_status TO authenticated;
