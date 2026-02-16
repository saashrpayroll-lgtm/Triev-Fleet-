-- Drop existing constraint
ALTER TABLE public.wallet_snapshots
DROP CONSTRAINT IF EXISTS wallet_snapshots_source_type_check;

-- Add updated constraint with new allowed values
ALTER TABLE public.wallet_snapshots
ADD CONSTRAINT wallet_snapshots_source_type_check 
CHECK (source_type IN (
    'INITIAL_IMPORT', 
    'MANUAL_SNAPSHOT', 
    'WEEKLY_CHECKPOINT', 
    'MONTHLY_CHECKPOINT',
    'RENT_COLLECTION_AUTO', 
    'MANUAL_TRUST_SYSTEM'
));
