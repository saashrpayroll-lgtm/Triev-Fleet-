-- This script fixes users who successfully registered in Supabase Auth
-- but were blocked from being inserted into public.users due to the 
-- prior role check constraint missing 'reportingManager'.

-- It ensures that any authenticated user missing from public.users is inserted.
-- We use a default user_id 'TRIEV_RM_SYNC' just so the NOT NULL constraint passes (if it exists).
-- You can edit their Employee ID later in the Admin Panel if needed.

INSERT INTO public.users (
    id,
    user_id,
    email,
    full_name,
    role,
    mobile,
    status
)
SELECT 
    id,
    COALESCE(raw_user_meta_data->>'user_id', 'SYNC_' || substr(id::text, 1, 8)),
    email,
    COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'role', 'reportingManager'),
    raw_user_meta_data->>'mobile',
    'active'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- Verification query: Check if 'saunvir@gmail.com' is now in public.users
SELECT id, email, role, status FROM public.users WHERE email = 'saunvir@gmail.com';
