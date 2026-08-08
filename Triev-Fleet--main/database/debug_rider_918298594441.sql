-- DEBUG: Ramanand Kumar Ray (918298594441)

WITH target_rider AS (
    SELECT id FROM public.riders WHERE mobile_number = '918298594441' LIMIT 1
),
latest_reset AS (
    SELECT transaction_date, amount
    FROM public.wallet_ledger, target_rider
    WHERE public.wallet_ledger.rider_id = target_rider.id AND mode = 'RESET'
    ORDER BY transaction_date DESC, created_at DESC
    LIMIT 1
),
adds AS (
    SELECT 
        wl.transaction_date,
        wl.amount,
        wl.transaction_type,
        wl.mode
    FROM public.wallet_ledger wl, target_rider, latest_reset lr
    WHERE wl.rider_id = target_rider.id 
      AND wl.mode = 'ADD' 
      AND wl.transaction_type != 'DAILY_COLLECTION'
      AND wl.transaction_date > lr.transaction_date
)
SELECT 
    '1_LATEST_RESET' as step, 
    lr.amount, 
    lr.transaction_date 
FROM latest_reset lr

UNION ALL

SELECT 
    '2_QUALIFYING_ADDS' as step, 
    a.amount, 
    a.transaction_date 
FROM adds a

UNION ALL

SELECT 
    '3_FUNCTION_CALL' as step, 
    public.calculate_rider_balance(target_rider.id) as amount,
    NOW() as transaction_date
FROM target_rider

UNION ALL

SELECT
    '4_STORED_BALANCE' as step,
    wallet_amount as amount,
    updated_at as transaction_date
FROM public.riders, target_rider
WHERE public.riders.id = target_rider.id;
