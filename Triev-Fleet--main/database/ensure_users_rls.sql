-- Enable RLS on users table (if not already enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
-- This is critical for the Realtime Subscription to work for permission updates
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Policy: Admins can view all users (for management)
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Policy: Team Leaders can view all users (for Leaderboard visibility?)
-- Currently Leaderboard fetches ALL TLs. If a TL logs in, they need to see other TLs stats.
-- So we need a policy for that too.
DROP POLICY IF EXISTS "Team Leaders can view other Team Leaders" ON public.users;
CREATE POLICY "Team Leaders can view other Team Leaders"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() AND users.role = 'teamLeader'
  )
  AND
  role = 'teamLeader' -- Can only view other TLs
);
