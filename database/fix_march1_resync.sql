-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH v3: Resync daily_collections using created_at IST as the date source
-- (transaction_date is an unreliable naive timestamp — excluded from COALESCE)
-- Safe: ON CONFLICT DO UPDATE — no data loss.
-- ═══════════════════════════════════════════════════════════════════════════

-- STEP 1: Full resync using only created_at IST for date (confirmed correct by diagnostic)
WITH grouped AS (
    SELECT
        r.team_leader_id                                           AS tl_id,
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE         AS v_date,
        SUM(wl.amount)                                            AS total_collection
    FROM public.wallet_ledger wl
    JOIN public.riders r ON wl.rider_id = r.id
    WHERE wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
      AND wl.mode = 'ADD'
      AND r.team_leader_id IS NOT NULL
    GROUP BY r.team_leader_id, (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
),
with_fleet AS (
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
                  AND (r2.created_at AT TIME ZONE 'Asia/Kolkata')::DATE <= g.v_date
                  AND (r2.inactivated_at IS NULL
                       OR (r2.inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > g.v_date)
            ), 1
        ) AS active_riders_count
    FROM grouped g
)
INSERT INTO public.daily_collections
    (team_leader_id, date, total_collection, active_riders_count, updated_at)
SELECT tl_id, v_date, total_collection, active_riders_count, NOW()
FROM with_fleet
ON CONFLICT (team_leader_id, date) DO UPDATE SET
    total_collection    = EXCLUDED.total_collection,
    active_riders_count = EXCLUDED.active_riders_count,
    updated_at          = NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Patch the sync trigger to ALSO use created_at IST as primary date
-- (removes the unreliable transaction_date from COALESCE)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sync_ledger_to_daily_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_tl_id        UUID;
    v_date         DATE;
    v_active_count INTEGER;
BEGIN
    -- Get TL ID for this rider
    SELECT team_leader_id INTO v_tl_id
    FROM public.riders
    WHERE id = NEW.rider_id;

    IF v_tl_id IS NULL THEN RETURN NEW; END IF;

    -- Use created_at IST as the authoritative date.
    -- metadata date_on_sheet is only used when admin explicitly sets a backdated entry.
    v_date := COALESCE(
        ((NEW.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE,
        (NEW.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    );

    -- Historical fleet count for this date
    SELECT COUNT(*)::INTEGER INTO v_active_count
    FROM public.riders
    WHERE team_leader_id = v_tl_id
      AND status != 'deleted'
      AND (created_at    AT TIME ZONE 'Asia/Kolkata')::DATE <= v_date
      AND (inactivated_at IS NULL
           OR (inactivated_at AT TIME ZONE 'Asia/Kolkata')::DATE > v_date);

    IF v_active_count = 0 THEN v_active_count := 1; END IF;

    -- Upsert: sum all matching wallet_ledger rows for this TL + date
    INSERT INTO public.daily_collections (team_leader_id, date, total_collection, active_riders_count, updated_at)
    VALUES (
        v_tl_id,
        v_date,
        (
            SELECT COALESCE(SUM(wl.amount), 0)
            FROM public.wallet_ledger wl
            JOIN public.riders r ON wl.rider_id = r.id
            WHERE r.team_leader_id = v_tl_id
              AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE = v_date
              AND wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
              AND wl.mode = 'ADD'
        ),
        v_active_count,
        NOW()
    )
    ON CONFLICT (team_leader_id, date) DO UPDATE SET
        total_collection    = EXCLUDED.total_collection,
        active_riders_count = EXCLUDED.active_riders_count,
        updated_at          = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Verify March 1 — should now match the diagnostic Query 3 output
-- ═══════════════════════════════════════════════════════════════════════════
SELECT
    dc.date,
    u.full_name                                                                     AS team_leader,
    dc.total_collection,
    dc.active_riders_count,
    ROUND(dc.total_collection::NUMERIC / GREATEST(dc.active_riders_count, 1), 2)   AS avg_per_rider,
    dc.updated_at
FROM public.daily_collections dc
JOIN public.users u ON dc.team_leader_id = u.id
WHERE dc.date = '2026-03-01'
ORDER BY dc.total_collection DESC;
