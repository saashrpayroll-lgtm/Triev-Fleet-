-- PERMANENT MOBILE STANDARDIZATION (+91)
-- 1. Shared function to extract last 10 digits and add +91.
-- 2. Triggers for automated enforcement on INSERT/UPDATE.
-- 3. One-time cleanup for existing records.

BEGIN;

-- 1. Create the Standardization Function
CREATE OR REPLACE FUNCTION public.standardize_indian_mobile()
RETURNS TRIGGER AS $$
DECLARE
    v_clean_number TEXT;
BEGIN
    -- Only proceed if mobile_number is provided
    IF NEW.mobile_number IS NULL OR NEW.mobile_number = '' THEN
        RETURN NEW;
    END IF;

    -- Step A: Remove all non-numeric characters (spaces, dashes, plus, etc.)
    v_clean_number := regexp_replace(NEW.mobile_number, '[^0-9]', '', 'g');

    -- Step B: Extract the last 10 digits (Standard Indian Mobile Length)
    -- If the number is less than 10 digits, we keep it as is (might be invalid, but we don't truncate data)
    IF length(v_clean_number) >= 10 THEN
        v_clean_number := right(v_clean_number, 10);
        -- Step C: Prepend +91
        NEW.mobile_number := '+91' || v_clean_number;
    ELSE
        -- If it's a short/invalid number, we still ensure the standard +91 prefix for consistency if it's purely digits
        NEW.mobile_number := '+91' || v_clean_number;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach Trigger to 'riders' table
DROP TRIGGER IF EXISTS trg_standardize_rider_mobile ON public.riders;
CREATE TRIGGER trg_standardize_rider_mobile
    BEFORE INSERT OR UPDATE OF mobile_number ON public.riders
    FOR EACH ROW
    EXECUTE FUNCTION public.standardize_indian_mobile();

-- 3. Attach Trigger to 'leads' table
DROP TRIGGER IF EXISTS trg_standardize_lead_mobile ON public.leads;
CREATE TRIGGER trg_standardize_lead_mobile
    BEFORE INSERT OR UPDATE OF mobile_number ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.standardize_indian_mobile();

-- 4. PERFORM ONE-TIME CLEANUP (Catch-up)
-- This will trigger the functions for all existing rows
UPDATE public.riders SET mobile_number = mobile_number WHERE mobile_number IS NOT NULL;
UPDATE public.leads SET mobile_number = mobile_number WHERE mobile_number IS NOT NULL;

COMMIT;
