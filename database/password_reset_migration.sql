-- Password Reset System Database Migration
-- Run this in your Supabase SQL Editor

-- 1. Create password_reset_requests table
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mobile_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Add columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_mobile ON password_reset_requests(mobile_number);
CREATE INDEX IF NOT EXISTS idx_users_force_password_change ON users(force_password_change);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
-- Allow anyone to insert reset requests (for forgot password)
CREATE POLICY "Anyone can request password reset" ON password_reset_requests
  FOR INSERT WITH CHECK (true);

-- Allow admins to view all reset requests
CREATE POLICY "Admins can view all reset requests" ON password_reset_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Allow admins to update reset requests
CREATE POLICY "Admins can update reset requests" ON password_reset_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- 6. Create function to check for existing pending requests
CREATE OR REPLACE FUNCTION check_pending_reset_request(p_mobile TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM password_reset_requests prr
    JOIN users u ON prr.user_id = u.id
    WHERE u.mobile = p_mobile 
    AND prr.status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant permissions
GRANT SELECT, INSERT ON password_reset_requests TO authenticated;
GRANT SELECT, INSERT ON password_reset_requests TO anon;
