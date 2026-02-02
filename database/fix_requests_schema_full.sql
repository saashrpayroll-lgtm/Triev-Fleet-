-- Comprehensive Fix for 'requests' table
-- This script adds ALL potentially missing columns referenced by the Admin Panel

-- 1. Basic Fields
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ticket_id SERIAL; -- Assuming it should be an auto-incrementing ID, or use BIGINT if generated elsewhere
ALTER TABLE requests ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'low';

-- 2. User info
ALTER TABLE requests ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS user_role TEXT;

-- 3. Status & Timestamps
ALTER TABLE requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- 4. Related Entity (User/Rider linking)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS related_entity_id UUID;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS related_entity_name TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS related_entity_type TEXT;

-- 5. Resolution Fields
ALTER TABLE requests ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS admin_response TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- 6. Timeline (JSONB array for history)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;

-- 7. Create Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
