-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC: Understand wallet_ledger date columns for March 1 2026
-- Run this FIRST — it tells us exactly why the resync is missing entries.
-- ═══════════════════════════════════════════════════════════════════════════

-- QUERY 1: How many total ledger rows exist for each IST-date resolution method?
-- This shows which column actually has March 1 data.
SELECT
    -- Method A: metadata date_on_sheet
    COUNT(*) FILTER (
        WHERE ((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE = '2026-03-01'
    ) AS via_metadata,

    -- Method B: transaction_date column cast to IST
    COUNT(*) FILTER (
        WHERE (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE = '2026-03-01'
    ) AS via_transaction_date_ist,

    -- Method C: transaction_date treated as plain DATE (no timezone)
    COUNT(*) FILTER (
        WHERE wl.transaction_date::DATE = '2026-03-01'
    ) AS via_transaction_date_plain,

    -- Method D: created_at cast to IST
    COUNT(*) FILTER (
        WHERE (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE = '2026-03-01'
    ) AS via_created_at_ist,

    COUNT(*) AS total_march1_by_created_at_ist
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
  AND wl.mode = 'ADD'
  AND r.team_leader_id IS NOT NULL
  -- Broad window: anything that *might* be March 1 by any measure
  AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE BETWEEN '2026-02-28' AND '2026-03-02';

-- ─────────────────────────────────────────────────────────────────────────
-- QUERY 2: Sample 20 raw rows around March 1 — inspect actual column values
-- ─────────────────────────────────────────────────────────────────────────
SELECT
    wl.id,
    wl.transaction_type,
    wl.mode,
    wl.amount,
    wl.created_at,
    (wl.created_at AT TIME ZONE 'Asia/Kolkata')               AS created_at_ist,
    (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE         AS created_at_ist_date,
    wl.transaction_date,
    wl.transaction_date::DATE                                  AS txn_date_plain,
    wl.metadata->>'date_on_sheet'                              AS metadata_date_on_sheet,
    r.team_leader_id
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
  AND wl.mode = 'ADD'
  AND r.team_leader_id IS NOT NULL
  AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE BETWEEN '2026-02-28' AND '2026-03-02'
ORDER BY wl.created_at DESC
LIMIT 30;

-- ─────────────────────────────────────────────────────────────────────────
-- QUERY 3: Total collection for March 1 using ONLY created_at IST (simple)
-- Compare this against your expected actual total to verify accuracy
-- ─────────────────────────────────────────────────────────────────────────
SELECT
    u.full_name AS team_leader,
    COUNT(*) AS entry_count,
    SUM(wl.amount) AS total_collection
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
JOIN public.users u ON r.team_leader_id = u.id
WHERE wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
  AND wl.mode = 'ADD'
  AND r.team_leader_id IS NOT NULL
  AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE = '2026-03-01'
GROUP BY u.full_name, r.team_leader_id
ORDER BY total_collection DESC;
