-- Enable RLS on notifications if not already
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Policy for UPDATE (Critical for "Mark as Read")
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Policy for DELETE (Clear All)
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = user_id);

-- Policy for INSERT (Usually system inserts, but if users trigger it)
-- System usually uses service_role, so this might not be strictly needed for user context, 
-- but good for completeness if client-side logic creates notifications.
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
CREATE POLICY "Users can insert their own notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);
