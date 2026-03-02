-- ════════════════════════════════════════════════════════════════════════════
-- WALLET VERIFICATION QUERIES (Updated for correct model)
-- Business Rule: wallet_amount = DAY_OPENING_BALANCE only (DAILY_COLLECTION excluded)
-- Run ONE BY ONE in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 1: Balance Drift Check
-- wallet_amount should exactly equal the latest RESET (DAY_OPENING_BALANCE).
-- ✅ Expected: 0 rows
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    r.rider_name,
    r.triev_id,
    r.wallet_amount                             AS cached_balance,
    public.calculate_rider_balance(r.id)        AS recalculated_balance,
    r.wallet_amount
      - public.calculate_rider_balance(r.id)   AS drift
FROM public.riders r
WHERE r.status = 'active'
  AND ABS(r.wallet_amount - public.calculate_rider_balance(r.id)) > 0.01
ORDER BY ABS(r.wallet_amount - public.calculate_rider_balance(r.id)) DESC
LIMIT 50;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 2: Today's Bulk Update Summary
-- Shows all riders updated today with their new balance.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    r.rider_name,
    r.triev_id,
    wl.amount           AS reset_balance,
    r.wallet_amount     AS current_wallet,
    (wl.amount = r.wallet_amount) AS is_in_sync,
    (wl.created_at AT TIME ZONE 'Asia/Kolkata')::TEXT AS imported_at_ist
FROM public.wallet_ledger wl
JOIN public.riders r ON r.id = wl.rider_id
WHERE wl.mode = 'RESET'
  AND wl.transaction_type = 'DAY_OPENING_BALANCE'
  AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
      = (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE
ORDER BY wl.created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 3: Full Ledger for a Specific Rider
-- Replace 'TRIEV_ID_HERE' with actual Triev ID (e.g. '30256')
-- Shows RESET entries (wallet balance) and DAILY_COLLECTION entries (separate).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    wl.mode,
    wl.transaction_type,
    wl.amount,
    wl.source_type,
    wl.description,
    (wl.created_at AT TIME ZONE 'Asia/Kolkata')::TEXT AS created_ist
FROM public.wallet_ledger wl
JOIN public.riders r ON r.id = wl.rider_id
WHERE r.triev_id = 'TRIEV_ID_HERE'   -- ← Change this
ORDER BY wl.created_at DESC
LIMIT 30;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 4: Overall Active Rider Wallet Stats
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    COUNT(*)                                            AS total_active_riders,
    COUNT(*) FILTER (WHERE wallet_amount > 0)           AS positive_count,
    COUNT(*) FILTER (WHERE wallet_amount < 0)           AS negative_count,
    COUNT(*) FILTER (WHERE wallet_amount = 0)           AS zero_count,
    SUM(wallet_amount) FILTER (WHERE wallet_amount > 0) AS total_positive_amt,
    SUM(wallet_amount) FILTER (WHERE wallet_amount < 0) AS total_negative_amt
FROM public.riders
WHERE status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 5: Riders with NO RESET entry (wallet not yet updated by bulk import)
-- These riders still have old/stale wallet_amount.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT r.rider_name, r.triev_id, r.wallet_amount
FROM public.riders r
WHERE r.status = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM public.wallet_ledger wl
      WHERE wl.rider_id = r.id AND wl.mode IN ('RESET', 'SET')
  )
ORDER BY r.rider_name;
