-- ENABLE IMPORT HISTORY DETAILS
-- Add columns to explicitly track the count and detailed reasons for skipped rows during bulk imports.

BEGIN;

-- Safely add the columns if they don't already exist
ALTER TABLE public.import_history 
ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0;

ALTER TABLE public.import_history 
ADD COLUMN IF NOT EXISTS skipped_details JSONB DEFAULT '[]'::jsonb;

COMMIT;
