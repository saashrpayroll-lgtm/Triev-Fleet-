-- Rebuild daily_collections from wallet_ledger
-- This ensures that all existing data (including recent imports) is correctly aggregated.

-- 1. Clear existing data (Safe because wallet_ledger is the source of truth)
TRUNCATE TABLE public.daily_collections;

-- 2. Populate from wallet_ledger
INSERT INTO public.daily_collections (team_leader_id, date, total_collection)
SELECT 
    r.team_leader_id,
    COALESCE((wl.metadata->>'date_on_sheet')::DATE, wl.created_at::DATE) as txn_date,
    SUM(
        CASE 
            WHEN wl.mode = 'ADD' THEN wl.amount 
            WHEN wl.mode = 'SUBTRACT' THEN -wl.amount 
            ELSE 0 
        END
    ) as total_collection
FROM public.wallet_ledger wl
JOIN public.riders r ON wl.rider_id = r.id
WHERE r.team_leader_id IS NOT NULL
GROUP BY r.team_leader_id, txn_date
ON CONFLICT (team_leader_id, date) 
DO UPDATE SET total_collection = EXCLUDED.total_collection;
