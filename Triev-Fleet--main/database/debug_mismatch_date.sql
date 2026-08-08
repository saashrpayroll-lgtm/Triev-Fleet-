-- RUN THIS IN SUPABASE TO FIND THE MISMATCHED ₹300 ENTRY
-- This query finds transactions that were created on March 2nd (showing up in Wallet Ledger)
-- But their actual "effective date" is something else (which is why they don't count towards March 2nd metrics).

SELECT 
    wl.amount,
    wl.metadata->>'source' AS source,
    wl.metadata->>'date_on_sheet' AS date_on_sheet,
    wl.created_at AT TIME ZONE 'Asia/Kolkata' AS created_at_ist,
    public.ledger_effective_date(wl) AS effective_dashboard_date
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
JOIN public.users u ON r.team_leader_id = u.id
WHERE u.full_name LIKE '%Aftab%'
  AND wl.mode = 'ADD' 
  AND wl.transaction_type IN ('DAILY_COLLECTION','RENT_COLLECTION','FTD_COLLECTION','COLLECTION')
  AND (wl.created_at AT TIME ZONE 'Asia/Kolkata')::DATE = '2026-03-02'
  AND public.ledger_effective_date(wl) != '2026-03-02';
