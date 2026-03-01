-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH: Resync daily_collections for any stale/missing dates
-- Run this in Supabase SQL Editor to fix March 1 (yesterday) and any other
-- dates where daily_collections doesn't match wallet_ledger reality.
-- SAFE: Uses INSERT ... ON CONFLICT DO UPDATE — no data loss.
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Upsert ALL (TL, date) pairs from wallet_ledger
-- This recalculates every row from scratch using wallet_ledger as source-of-truth.
-- Historical fleet count is reconstructed mathematically (v16 logic).

INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
SELECT
    r.team_leader_id,
    -- Normalize date with full IST awareness: metadata date_on_sheet > transaction_date > created_at
    COALESCE(
        ((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE,
        (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    ) AS v_date,
    SUM(wl.amount) AS total_collection,
    -- Reconstruct historical fleet at that date (v16 approach)
    GREATEST(
        (
            SELECT COUNT(*)::INTEGER
            FROM public.riders r2
            WHERE r2.team_leader_id = r.team_leader_id
              AND r2.status != 'deleted'
              AND (r2.created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= COALESCE(
                    ((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE,
                    (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
                    (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
                  )
              AND (r2.inactivated_at IS NULL OR
                   (r2.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > COALESCE(
                    ((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE,
                    (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
                    (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
                  ))
        ), 1
    ) AS active_riders_count,
    NOW() AS updated_at
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE wl.transaction_type IN ('DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION')
  AND wl.mode = 'ADD'
  AND r.team_leader_id IS NOT NULL
GROUP BY
    r.team_leader_id,
    COALESCE(
        ((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE,
        (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE,
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    )
ON CONFLICT (team_leader_id, date) DO UPDATE SET
    total_collection    = EXCLUDED.total_collection,
    active_riders_count = EXCLUDED.active_riders_count,
    updated_at          = NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Verify the March 1 data after the upsert
-- (Optional — inspect these rows to confirm accuracy)
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
    dc.date,
    u.full_name AS team_leader,
    dc.total_collection,
    dc.active_riders_count,
    ROUND(dc.total_collection::NUMERIC / GREATEST(dc.active_riders_count, 1), 2) AS avg_per_rider,
    dc.updated_at
FROM public.daily_collections dc
JOIN public.users u ON dc.team_leader_id = u.id
WHERE dc.date = '2026-03-01'   -- Change this date if needed
ORDER BY dc.total_collection DESC;
