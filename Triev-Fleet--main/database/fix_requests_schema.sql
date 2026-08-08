-- Add missing columns to requests table to support entity linking
ALTER TABLE requests ADD COLUMN IF NOT EXISTS related_entity_name TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS related_entity_type TEXT;

-- Index for better performance when filtering by type
CREATE INDEX IF NOT EXISTS idx_requests_related_entity_type ON requests(related_entity_type);
