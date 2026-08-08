-- REPAIR SCRIPT: Fix Overwritten Allotment Dates
-- Background: A bug in the bulk import logic caused `allotment_date` to be overwritten 
-- with the current date for ALL existing riders every time a sync was performed 
-- if the "Allotment Date" column was missing from the sheet.
-- Fix: We revert `allotment_date` to the original `created_at` timestamp for any records
-- where the `allotment_date` is later than the `created_at` date by more than 1 day.

BEGIN;

UPDATE public.riders
SET allotment_date = created_at
WHERE allotment_date::DATE > created_at::DATE;

COMMIT;
