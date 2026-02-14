
-- Function to update daily_collections on new credit transaction
CREATE OR REPLACE FUNCTION public.handle_new_wallet_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process 'credit' transactions (money IN)
    IF NEW.type = 'credit' AND NEW.team_leader_id IS NOT NULL THEN
        INSERT INTO public.daily_collections (team_leader_id, date, total_collection, updated_at)
        VALUES (
            NEW.team_leader_id, 
            DATE(NEW.timestamp), 
            NEW.amount, 
            NOW()
        )
        ON CONFLICT (team_leader_id, date) 
        DO UPDATE SET 
            total_collection = daily_collections.total_collection + EXCLUDED.total_collection,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Run ONLY on INSERT
-- We intentionally do NOT create a DELETE trigger, so deletions of transactions 
-- do NOT reduce the historical collection total, as requested.
DROP TRIGGER IF EXISTS on_wallet_transaction_insert ON public.wallet_transactions;
CREATE TRIGGER on_wallet_transaction_insert
    AFTER INSERT ON public.wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_wallet_transaction();
