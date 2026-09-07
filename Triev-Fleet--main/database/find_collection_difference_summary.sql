-- ═══════════════════════════════════════════════════════════════════════════════
-- TARGETED DIFFERENCE FINDER: TL-Wise & Date-Wise Summary
-- Run this in Supabase SQL Editor to see WHERE the Rs 600 difference is!
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TEAM LEADER WISE COLLECTION SUMMARY (Compare each TL's total with Excel)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
    COALESCE(r.team_leader_name, '--- UNASSIGNED (NO TL) ---') AS team_leader_name,
    COUNT(wl.id) AS total_transactions,
    SUM(wl.amount) AS total_collection_amount
FROM public.wallet_ledger wl
LEFT JOIN public.riders r ON wl.rider_id = r.id
WHERE wl.mode = 'ADD'
  AND wl.transaction_type IN (
      'DAILY_COLLECTION', 'RENT_COLLECTION', 'FTD_COLLECTION', 'COLLECTION',
      'RENT', 'DAILY COLLECTION', 'RENT COLLECTION', 'FTD COLLECTION',
      'RECHARGE', 'WALLET_RECHARGE', 'WALLET RECHARGE',
      'daily_collection', 'rent_collection', 'ftd_collection', 'collection',
      'rent', 'recharge', 'wallet_recharge'
  )
  AND (
      public.ledger_effective_date(wl) = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
      OR (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
  )
GROUP BY r.team_leader_name
ORDER BY total_collection_amount DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DATE-WISE TOTAL IN SYSTEM (Check if Rs 600 landed on yesterday / previous date)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
    public.ledger_effective_date(wl) AS date_ist,
    COUNT(wl.id) AS total_transactions,
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
  AND wl.created_at >= (NOW() - INTERVAL '3 days')
GROUP BY public.ledger_effective_date(wl)
ORDER BY date_ist DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CHECK NON-COLLECTION TYPES (Did any Rs 600 get tagged as different type?)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 
    wl.transaction_type,
    COUNT(*) AS count,
    SUM(wl.amount) AS total_amount
FROM public.wallet_ledger wl
WHERE wl.mode = 'ADD'
  AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
GROUP BY wl.transaction_type;
