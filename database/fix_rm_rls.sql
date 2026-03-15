BEGIN;

-- 1. Users table (Allow Reporting Managers to view all users to find their assigned Team Leaders)
DROP POLICY IF EXISTS "Reporting Managers can view all users" ON public.users;
CREATE POLICY "Reporting Managers can view all users"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS viewer 
    WHERE viewer.id = auth.uid() AND viewer.role = 'reportingManager'
  )
);

-- 2. Riders table
DROP POLICY IF EXISTS "Reporting Managers can view all riders" ON public.riders;
CREATE POLICY "Reporting Managers can view all riders"
ON public.riders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS viewer 
    WHERE viewer.id = auth.uid() AND viewer.role = 'reportingManager'
  )
);

-- 3. Leads table
DROP POLICY IF EXISTS "Reporting Managers can view all leads" ON public.leads;
CREATE POLICY "Reporting Managers can view all leads"
ON public.leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS viewer 
    WHERE viewer.id = auth.uid() AND viewer.role = 'reportingManager'
  )
);

-- 4. Daily Collections table
DROP POLICY IF EXISTS "Reporting Managers can view daily collections" ON public.daily_collections;
CREATE POLICY "Reporting Managers can view daily collections"
ON public.daily_collections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS viewer 
    WHERE viewer.id = auth.uid() AND viewer.role = 'reportingManager'
  )
);

-- 5. Transactions table
DROP POLICY IF EXISTS "Reporting Managers can view transactions" ON public.transactions;
CREATE POLICY "Reporting Managers can view transactions"
ON public.transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS viewer 
    WHERE viewer.id = auth.uid() AND viewer.role = 'reportingManager'
  )
);

-- 6. Wallet Ledger table
DROP POLICY IF EXISTS "Reporting Managers can view wallet ledger" ON public.wallet_ledger;
CREATE POLICY "Reporting Managers can view wallet ledger"
ON public.wallet_ledger
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS viewer 
    WHERE viewer.id = auth.uid() AND viewer.role = 'reportingManager'
  )
);

-- 7. Wallet Snapshots table
DROP POLICY IF EXISTS "Reporting Managers can view wallet snapshots" ON public.wallet_snapshots;
CREATE POLICY "Reporting Managers can view wallet snapshots"
ON public.wallet_snapshots
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS viewer 
    WHERE viewer.id = auth.uid() AND viewer.role = 'reportingManager'
  )
);

COMMIT;
