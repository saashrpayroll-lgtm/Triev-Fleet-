-- RUN THIS IN SUPABASE TO DEBUG MARCH 2ND MISSING DATA
SELECT 
    r.team_leader_id,
    u.full_name as tl_name,
    wl.amount,
    wl.metadata->>'date_on_sheet' AS raw_metadata_date,
    wl.transaction_date AS raw_txn_date,
    wl.created_at AS raw_created_at,
    -- This is exactly what ledger_effective_date() computes:
    COALESCE(
        CASE 
            WHEN wl.metadata->>'date_on_sheet' IS NOT NULL 
                 AND wl.metadata->>'date_on_sheet' ~ '^\d{4}-\d{2}-\d{2}'
            THEN ((wl.metadata->>'date_on_sheet')::TIMESTAMPTZ AT TIME ZONE 'Asia/Kolkata')::DATE
        END,
        CASE
            WHEN wl.transaction_date IS NOT NULL
            THEN (wl.transaction_date AT TIME ZONE 'Asia/Kolkata')::DATE
        END,
        (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE
    ) AS calculated_effective_date
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
JOIN public.users u ON r.team_leader_id = u.id
WHERE wl.mode = 'ADD' 
  AND wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
  AND wl.created_at >= '2026-03-01'
ORDER BY wl.created_at DESC
LIMIT 50;
