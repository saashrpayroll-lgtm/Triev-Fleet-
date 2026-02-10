-- Allow Team Leaders to view wallet transactions related to them
-- Note: This policy assumes 'activity_logs' has RLS enabled.

CREATE POLICY "Team Leaders can view their own wallet transactions"
    ON public.activity_logs
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.users WHERE role = 'teamLeader'
        )
        AND
        action_type = 'wallet_transaction'
        AND
        metadata->>'teamLeaderId' = auth.uid()::text
    );

-- Allow Admins to view all
CREATE POLICY "Admins can view all activity logs"
    ON public.activity_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );
