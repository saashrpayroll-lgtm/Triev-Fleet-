-- Allow Team Leaders to view ALL daily_collections (for History Leaderboard)
DROP POLICY IF EXISTS "Team Leaders can view their own collections" ON public.daily_collections;
CREATE POLICY "Team Leaders can view all collections"
ON public.daily_collections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND (users.role = 'teamLeader' OR users.role = 'admin')
  )
);

-- Allow Team Leaders to view ALL 'credit' wallet_transactions (for Today's Leaderboard)
-- We restrict this to valid Team Leaders viewing only CREDITS (Collections)
DROP POLICY IF EXISTS "Team Leaders can view their riders' transactions" ON public.wallet_transactions;

CREATE POLICY "Team Leaders can view relevant transactions"
ON public.wallet_transactions
FOR SELECT
USING (
  -- 1. My own transactions (as TL or Rider)
  team_leader_id = auth.uid() 
  OR rider_id IN (SELECT id FROM public.riders WHERE team_leader_id = auth.uid())
  
  OR 

  -- 2. ALL 'credit' transactions (if I am a Team Leader, for Leaderboard)
  (
    type = 'credit' 
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'teamLeader'
    )
  )
);
