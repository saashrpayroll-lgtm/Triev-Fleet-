-- =========================================================================================
-- AUTOMATIC WALLET RESET ON INACTIVATION
-- =========================================================================================
-- Objective: When a rider is marked as 'inactive', their wallet ledger should get a 
-- RESET transaction of 0, effectively clearing their balance.
-- =========================================================================================

BEGIN;

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.reset_rider_wallet_on_inactivation()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status changed to 'inactive'
    IF NEW.status = 'inactive' AND (OLD.status IS NULL OR OLD.status != 'inactive') THEN
        -- Insert a RESET transaction into wallet_ledger
        -- source_type 'SYSTEM' indicates this was an automated action.
        INSERT INTO public.wallet_ledger (
            rider_id,
            transaction_type,
            mode,
            amount,
            description,
            source_type,
            transaction_date,
            metadata
        ) VALUES (
            NEW.id,
            'INACTIVATION_RESET',
            'RESET',
            0,
            'Wallet automatically reset to 0 upon rider inactivation',
            'SYSTEM',
            NOW(),
            jsonb_build_object(
                'previous_status', OLD.status,
                'previous_wallet_amount', OLD.wallet_amount,
                'action', 'automatic_reset'
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the riders table
-- We use AFTER update so we have the final confirmation of the status change.
-- It only needs to fire when the status column is updated.
DROP TRIGGER IF EXISTS trg_reset_rider_wallet_on_inactivation ON public.riders;
CREATE TRIGGER trg_reset_rider_wallet_on_inactivation
    AFTER UPDATE OF status ON public.riders
    FOR EACH ROW
    EXECUTE FUNCTION public.reset_rider_wallet_on_inactivation();

COMMIT;
