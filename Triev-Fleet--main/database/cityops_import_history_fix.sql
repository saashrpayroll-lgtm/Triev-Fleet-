-- Fix RLS for import_history to allow City Ops roles to Insert and Select

-- 1. Ensure the authenticated user can INSERT into import_history
DROP POLICY IF EXISTS "Enable all for admins" ON public.import_history;
DROP POLICY IF EXISTS "Allow insert" ON public.import_history;
DROP POLICY IF EXISTS "Allow read" ON public.import_history;

CREATE POLICY "Enable ALL for authorized roles" ON public.import_history
FOR ALL USING (
  -- Condition for selecting/updating
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'manager', 'cityOps')
  )
) WITH CHECK (
  -- Condition for inserting
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'manager', 'cityOps')
  )
);

-- Force enable RLS if it was disabled accidentally
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;
