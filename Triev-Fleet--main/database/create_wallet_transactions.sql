-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_id UUID NOT NULL REFERENCES public.riders(id),
    team_leader_id UUID REFERENCES public.users(id),
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    performed_by TEXT, -- Email or ID of the admin/user who performed the action
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin can view all
DROP POLICY IF EXISTS "Admins can view all wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Admins can view all wallet transactions" 
ON public.wallet_transactions 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);

-- Team Leaders can view transactions for their riders (or where they are the TL)
DROP POLICY IF EXISTS "Team Leaders can view their riders' transactions" ON public.wallet_transactions;
CREATE POLICY "Team Leaders can view their riders' transactions" 
ON public.wallet_transactions 
FOR SELECT 
USING (
    team_leader_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.riders 
        WHERE riders.id = wallet_transactions.rider_id AND riders.team_leader_id = auth.uid()
    )
);

-- Admins can insert/update/delete (Validation via app logic mostly, but good to have)
DROP POLICY IF EXISTS "Admins can manage wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Admins can manage wallet transactions" 
ON public.wallet_transactions 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_rider_id ON public.wallet_transactions(rider_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_team_leader_id ON public.wallet_transactions(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_timestamp ON public.wallet_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON public.wallet_transactions(type);

-- MIGRATION: Copy from activity_logs
-- We select logs with action_type = 'wallet_transaction' and try to map fields
INSERT INTO public.wallet_transactions (
    rider_id, 
    team_leader_id, 
    amount, 
    type, 
    description, 
    metadata, 
    performed_by, 
    timestamp
)
SELECT 
    (metadata->>'riderId')::UUID, -- Assuming riderId is in metadata, fallback to target_id if needed, but safe to try cast
    (metadata->>'teamLeaderId')::UUID,
    COALESCE((metadata->>'amount')::NUMERIC, 0),
    COALESCE(metadata->>'type', 'credit'), -- Default to credit if missing, but should be there
    details,
    metadata,
    user_name,
    timestamp
FROM public.activity_logs
WHERE 
    action_type = 'wallet_transaction' 
    AND (metadata->>'amount')::NUMERIC > 0 -- Only migrate non-zero entries
    AND target_type = 'rider'
ON CONFLICT DO NOTHING; -- Avoid duplicates if run multiple times (though ID is random, so duplicates possible if run twice without cleanup. Ideally run once.)

-- NOTE: logic to dedup based on timestamp/rider_id could be added if strict idempotency needed, 
-- but for a one-time migration this is acceptable.
