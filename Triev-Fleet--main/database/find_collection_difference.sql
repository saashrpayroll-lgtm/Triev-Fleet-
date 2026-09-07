-- ═══════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC SQL: Collection Difference Finder (Excel vs System)
-- 
-- Difference: Rs 1,23,346 (Excel) - Rs 1,22,746 (System) = Rs 600
-- Run this in Supabase SQL Editor to pinpoint the exact Rs 600 discrepancy.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 1: Unassigned Riders (Riders without a Team Leader)
-- If a rider has no Team Leader, their collection is in wallet_ledger but
-- NOT in daily_collections (since daily_collections is grouped by team_leader_id).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
    '1. Unassigned Riders Collection' AS check_name,
    wl.id AS ledger_id,
    wl.amount,
    wl.transaction_type,
    wl.transaction_date,
    wl.created_at,
    wl.external_transaction_id,
    r.id AS rider_id,
    r.rider_name,
    r.triev_id,
    r.team_leader_id
FROM public.wallet_ledger wl
LEFT JOIN public.riders r ON wl.rider_id = r.id
WHERE wl.mode = 'ADD'
  AND (r.team_leader_id IS NULL OR r.id IS NULL)
  AND (wl.created_at >= (NOW() - INTERVAL '2 days') 
       OR wl.transaction_date >= (NOW() - INTERVAL '2 days'));


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 2: All Rs 600 Transactions (or Rs 300 x 2) in Recent Ledger
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
    '2. Exact Rs 600 Transactions' AS check_name,
    wl.id AS ledger_id,
    wl.amount,
    wl.transaction_type,
    wl.transaction_date,
    wl.created_at,
    wl.external_transaction_id,
    r.rider_name,
    r.triev_id,
    r.team_leader_name
FROM public.wallet_ledger wl
LEFT JOIN public.riders r ON wl.rider_id = r.id
WHERE wl.amount IN (600, 300)
  AND (wl.created_at >= (NOW() - INTERVAL '2 days') 
       OR wl.transaction_date >= (NOW() - INTERVAL '2 days'))
ORDER BY wl.created_at DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 3: Date Breakdown (Check if Rs 600 went to Yesterday or Tomorrow)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
    '3. Date Breakdown' AS check_name,
    public.ledger_effective_date(wl) AS effective_date,
    COUNT(*) AS total_transactions,
    SUM(wl.amount) AS total_amount
FROM public.wallet_ledger wl
WHERE wl.mode = 'ADD'
  AND wl.transaction_type IN (
      'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
      'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
      'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
      'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
      'rent', 'recharge', 'wallet_recharge'
  )
  AND wl.created_at >= (NOW() - INTERVAL '5 days')
GROUP BY public.ledger_effective_date(wl)
ORDER BY effective_date DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 4: Summary Comparison (Wallet Ledger vs Daily Collections for Today)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
    '4. Today Ledger Total' AS metric,
    COUNT(*) AS tx_count,
    SUM(wl.amount) AS total_amount
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE wl.mode = 'ADD'
  AND wl.transaction_type IN (
      'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
      'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
      'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
      'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
      'rent', 'recharge', 'wallet_recharge'
  )
  AND public.ledger_effective_date(wl) = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE

UNION ALL

SELECT 
    '4. Today daily_collections Total' AS metric,
    COUNT(*) AS tx_count,
    SUM(total_collection) AS total_amount
FROM public.daily_collections
WHERE date = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
