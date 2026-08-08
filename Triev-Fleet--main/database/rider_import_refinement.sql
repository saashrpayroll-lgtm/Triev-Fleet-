-- Refine Import History and Rider tracking
-- 1. Add updated_count to import_history
ALTER TABLE import_history 
ADD COLUMN IF NOT EXISTS updated_count INTEGER DEFAULT 0;

-- 2. Ensure inactivated_at exists on riders (it should, but just in case)
ALTER TABLE riders 
ADD COLUMN IF NOT EXISTS inactivated_at TIMESTAMPTZ;

-- 3. Add index on inactivated_at for performance metrics efficiency
CREATE INDEX IF NOT EXISTS idx_riders_inactivated_at ON riders(inactivated_at);

-- 4. Update the Import History table comment
COMMENT ON COLUMN import_history.updated_count IS 'Number of existing records updated during this import';
