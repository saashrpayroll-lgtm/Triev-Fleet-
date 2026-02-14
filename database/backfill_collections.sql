
-- 1. Clear existing (optional, or we can upsert)
-- TRUNCATE TABLE daily_collections;

-- 2. Insert Aggregated Data (Upsert on conflict)
INSERT INTO daily_collections (team_leader_id, date, total_collection, created_at, updated_at)
SELECT 
    team_leader_id,
    DATE(timestamp) as date,
    SUM(amount) as total_collection,
    NOW(),
    NOW()
FROM 
    wallet_transactions
WHERE 
    type = 'credit' 
    AND team_leader_id IS NOT NULL
GROUP BY 
    team_leader_id, DATE(timestamp)
ON CONFLICT (team_leader_id, date) 
DO UPDATE SET 
    total_collection = EXCLUDED.total_collection,
    updated_at = NOW();

-- 3. Verify
SELECT count(*) as total_records FROM daily_collections;
