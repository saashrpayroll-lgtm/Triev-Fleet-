-- Enable RLS on notifications if not already
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Ensure "authenticated" role has UPDATE permissions (often missing if table was created via UI without explicit grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

-- Fix the UPDATE policy explicitly with both USING and WITH CHECK
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create a bulletproof RPC function to mark all notifications as read
-- This function runs with SECURITY DEFINER, meaning it bypasses RLS and executes with creator privileges.
-- This guarantees that marking all as read will never fail due to RLS edge cases or URL length limits.
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET 
    is_read = true, 
    read_at = now()
  WHERE 
    user_id = p_user_id 
    AND is_read = false;
END;
$$;
