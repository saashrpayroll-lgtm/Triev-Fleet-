-- Migration: Move existing Rider Wallet Balances to Ledger

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, wallet_amount FROM public.riders WHERE wallet_amount != 0 LOOP
        -- Insert 'SET' transaction for existing balance
        INSERT INTO public.wallet_ledger (
            rider_id, 
            transaction_type, 
            mode, 
            amount, 
            description, 
            metadata, 
            created_at
        ) VALUES (
            r.id,
            'SYSTEM_IMPORT',
            'SET',
            r.wallet_amount,
            'Initial Migration from Legacy Wallet System',
            '{"details": "Automated Migration"}'::jsonb,
            NOW()
        );
    END LOOP;
END $$;
