
-- 1. Clear existing (optional, or we can upsert)
-- 1. Clear existing (Preferred for clean timezone reset)
TRUNCATE TABLE public.daily_collections;

-- 2. Insert Aggregated Data (Upsert on conflict)
INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
SELECT 
    team_leader_id,
    DATE(timestamp AT TIME ZONE 'Asia/Kolkata') as date, -- Force IST Date
    SUM(amount) as total_collection,
    NOW()
FROM 
    public.wallet_transactions
WHERE 
    type = 'credit' 
    AND team_leader_id IS NOT NULL
GROUP BY 
    team_leader_id, DATE(timestamp AT TIME ZONE 'Asia/Kolkata')
ON CONFLICT (team_leader_id, date) 
DO UPDATE SET 
    total_collection = EXCLUDED.total_collection,
    updated_at = NOW();

-- 3. Verify
SELECT count(*) as total_records FROM daily_collections;
