-- DEBUG SCRIPT: View Raw Ledger and Calculate Balance
-- Rider: Babul Singh (919508604046)

WITH target_rider AS (
    SELECT id FROM public.riders WHERE mobile_number = '919508604046' LIMIT 1
),
latest_reset AS (
    SELECT transaction_date, amount
    FROM public.wallet_ledger, target_rider
    WHERE rider_id = target_rider.id AND mode = 'RESET'
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1
)
SELECT 
    'RAW_LEDGER' as section,
    transaction_date, 
    mode, 
    amount, 
    transaction_type, 
    created_at
FROM public.wallet_ledger, target_rider
WHERE rider_id = target_rider.id
ORDER BY transaction_date DESC, created_at DESC
LIMIT 10;

-- 2. Simulate Calculation
WITH target_rider AS (
    SELECT id FROM public.riders WHERE mobile_number = '919508604046' LIMIT 1
),
latest_reset AS (
    SELECT transaction_date, amount
    FROM public.wallet_ledger, target_rider
    WHERE public.wallet_ledger.rider_id = target_rider.id AND mode = 'RESET'
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1
),
adds AS (
    SELECT COALESCE(SUM(wl.amount), 0) as total_add
    FROM public.wallet_ledger wl, target_rider, latest_reset lr
    WHERE wl.rider_id = target_rider.id 
      AND wl.mode = 'ADD' 
      AND wl.transaction_date > lr.transaction_date
),
subtracts AS (
    SELECT COALESCE(SUM(wl.amount), 0) as total_sub
    FROM public.wallet_ledger wl, target_rider, latest_reset lr
    WHERE wl.rider_id = target_rider.id 
      AND wl.mode = 'SUBTRACT' 
      AND wl.transaction_date > lr.transaction_date
)
SELECT 
    'CALCULATION_DEBUG' as section,
    lr.amount as reset_amount,
    lr.transaction_date as reset_date,
    COALESCE(a.total_add, 0) as adds_after_reset,
    COALESCE(s.total_sub, 0) as subtracts_after_reset,
    (lr.amount + COALESCE(a.total_add, 0) - COALESCE(s.total_sub, 0)) as calculated_balance
FROM latest_reset lr
LEFT JOIN adds a ON true
LEFT JOIN subtracts s ON true;
