-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH: Resync daily_collections for any stale / missing dates (Fixed v2)
-- Safe: Uses INSERT … ON CONFLICT DO UPDATE — no data loss.
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Pre-flatten wallet_ledger with the resolved IST date in a CTE,
--         then group, then attach the historical fleet count.
--         This avoids the "ungrouped column from outer query" error.

WITH ledger_with_date AS (
    -- Resolve the IST date once per transaction row
    SELECT
        r.team_leader_id                                                           AS tl_id,
        COALESCE(
            ((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE,
            (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
            (wl.created_at       AT TIME ZONE 'Asia/Kolkata')::DATE
        )                                                                          AS v_date,
        wl.amount
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
      AND wl.mode = 'ADD'
      AND r.team_leader_id IS NOT NULL
),
grouped AS (
    -- Sum per (TL, date)
    SELECT
        tl_id,
        v_date,
        SUM(amount) AS total_collection
    FROM ledger_with_date
    GROUP BY tl_id, v_date
),
with_fleet AS (
    -- Attach historical fleet count (how many riders were active on v_date)
    SELECT
        g.tl_id,
        g.v_date,
        g.total_collection,
        GREATEST(
            (
                SELECT COUNT(*)::INTEGER
                FROM public.riders r2
                WHERE r2.team_leader_id = g.tl_id
                  AND r2.status != 'deleted'
                  AND (r2.created_at     AT TIME ZONE 'Asia/Kolkata')::DATE <= g.v_date
                  AND (r2.inactivated_at IS NULL
                       OR (r2.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > g.v_date)
            ), 1
        ) AS active_riders_count
    FROM grouped g
)
INSERT INTO public.daily_collections
    (team_leader_id, date, total_collection, active_riders_count, updated_at)
SELECT
    tl_id,
    v_date,
    total_collection,
    active_riders_count,
    NOW()
FROM with_fleet
ON CONFLICT (team_leader_id, date) DO UPDATE SET
    total_collection    = EXCLUDED.total_collection,
    active_riders_count = EXCLUDED.active_riders_count,
    updated_at          = NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Verify March 1 data after the upsert
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
    dc.date,
    u.full_name                                                            AS team_leader,
    dc.total_collection,
    dc.active_riders_count,
    ROUND(dc.total_collection::NUMERIC / GREATEST(dc.active_riders_count,1), 2) AS avg_per_rider,
    dc.updated_at
FROM public.daily_collections dc
JOIN public.users u ON dc.team_leader_id = u.id
WHERE dc.date = '2026-03-01'
ORDER BY dc.total_collection DESC;
