-- Helper function to check if current user is admin (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is team leader (Bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_team_leader()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
    AND role = 'teamLeader'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply RLS policies using the new functions
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 1. Users can always view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- 2. Admins can view ALL users
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (public.is_admin());

-- 3. Team Leaders can view other Team Leaders (for Leaderboard)
--    AND potentially their own riders if we linked them, but riders are in 'riders' table.
--    The Leaderboard query fetches ALL users with role='teamLeader'.
DROP POLICY IF EXISTS "Team Leaders can view other Team Leaders" ON public.users;
CREATE POLICY "Team Leaders can view other Team Leaders"
ON public.users
FOR SELECT
USING (
  public.is_team_leader() 
  AND 
  role = 'teamLeader' 
);
