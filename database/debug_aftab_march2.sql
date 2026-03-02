-- RUN THIS IN SUPABASE TO DEBUG AFTAB'S MARCH 2ND COLLECTION DISCREPANCY
-- Original Total: ₹15,447, System Total: ₹15,147 (Missing ₹300)

SELECT 
    r.id AS rider_id,
    r.name AS rider_name,
    wl.amount,
    wl.metadata->>'source' AS source,
    wl.metadata->>'transaction_id' AS sheet_txn_id,
    wl.created_at AT TIME ZONE 'Asia/Kolkata' AS created_at_ist,
    wl.transaction_date AT TIME ZONE 'Asia/Kolkata' AS txn_date_ist,
    wl.metadata->>'date_on_sheet' AS date_on_sheet
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
JOIN public.users u ON r.team_leader_id = u.id
WHERE u.full_name LIKE '%Aftab%'
  AND wl.mode = 'ADD' 
  AND wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
  AND public.ledger_effective_date(wl) = '2026-03-02'
ORDER BY wl.amount DESC;
