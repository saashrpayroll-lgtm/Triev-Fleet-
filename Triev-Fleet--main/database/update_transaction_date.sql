-- FUNCTION: Update the date of a wallet transaction
-- Used to correct "Daily Collections" that were imported on the wrong day.

CREATE OR REPLACE FUNCTION public.update_wallet_transaction_date(
    p_transaction_id UUID,
    p_new_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
    v_old_entry RECORD;
BEGIN
    -- 1. Verify Permission (Only Admins)
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can modify transaction dates.';
    END IF;

    -- 2. Fetch Existing Record
    SELECT * INTO v_old_entry FROM public.wallet_ledger WHERE id = p_transaction_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaction not found.';
    END IF;

    -- 3. Update Record
    -- We update both created_at (for sorting) and transaction_date (for logic)
    -- The trigger 'sync_ledger_to_daily_metrics' will handle the math (Decrement Old Date, Increment New Date)
    UPDATE public.wallet_ledger
    SET 
        created_at = p_new_date,
        transaction_date = p_new_date::DATE,
        metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb), 
            '{date_modified_by}', 
            to_jsonb(auth.uid())
        )
    WHERE id = p_transaction_id;

    RETURN jsonb_build_object('success', true, 'message', 'Date updated successfully');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
