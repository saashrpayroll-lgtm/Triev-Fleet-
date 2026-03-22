-- Fix for "Permanent Delete" Rider Foreign Key Constraint Error
-- This script safely updates ALL foreign keys that reference the `riders(id)` table
-- completely automatically. It gives them `ON DELETE CASCADE` so that
-- permanently deleting a rider also cleans up their wallet_mismatches, wallet_ledger, etc.
-- without crashing.

DO $$
DECLARE
    fk_record RECORD;
    drop_query TEXT;
    add_query TEXT;
BEGIN
    FOR fk_record IN 
        SELECT
            tc.table_name,
            kcu.column_name,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'riders'
          AND ccu.column_name = 'id'
          AND tc.table_schema = 'public'
    LOOP
        -- Drop the existing constraint safely
        drop_query := format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I;', fk_record.table_name, fk_record.constraint_name);
        EXECUTE drop_query;
        
        -- Add the same constraint back, but with ON DELETE CASCADE
        add_query := format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.riders(id) ON DELETE CASCADE;', 
                            fk_record.table_name, fk_record.constraint_name, fk_record.column_name);
        EXECUTE add_query;
        
        RAISE NOTICE 'Updated foreign key % on table % to CASCADE DELETE', fk_record.constraint_name, fk_record.table_name;
    END LOOP;
END;
$$;
