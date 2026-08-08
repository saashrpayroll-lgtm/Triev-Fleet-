-- Migration: Add related_entity_id column to requests table
-- This column is needed to link requests to related entities (riders, users, etc.)

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'requests' 
        AND column_name = 'related_entity_id'
    ) THEN
        ALTER TABLE requests 
        ADD COLUMN related_entity_id UUID;
        
        -- Add comment to explain the column
        COMMENT ON COLUMN requests.related_entity_id IS 'ID of the related entity (rider, user, etc.) associated with this request';
        
        RAISE NOTICE 'Column related_entity_id added to requests table';
    ELSE
        RAISE NOTICE 'Column related_entity_id already exists in requests table';
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_requests_related_entity_id 
ON requests(related_entity_id);

COMMENT ON INDEX idx_requests_related_entity_id IS 'Index for faster lookups by related entity ID';
