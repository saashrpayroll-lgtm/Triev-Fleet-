SELECT transaction_type, mode, count(*) 
FROM wallet_ledger 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY transaction_type, mode;

SELECT * FROM wallet_ledger 
WHERE transaction_type ILIKE '%COLLECTION%' 
ORDER BY created_at DESC 
LIMIT 10;
